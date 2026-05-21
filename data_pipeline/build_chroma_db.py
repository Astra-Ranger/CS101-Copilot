#!/usr/bin/env python3
"""Build a persistent ChromaDB vector store from structured course Markdown files."""

from __future__ import annotations

import argparse
import logging
import re
import shutil
from pathlib import Path
from typing import Any, Iterable


DEFAULT_INPUT_DIR = "course_data"
DEFAULT_PERSIST_DIR = "chroma_db"
DEFAULT_COLLECTION_NAME = "cs101_course_markdown"
DEFAULT_BATCH_SIZE = 100
DEFAULT_CHUNK_SIZE = 2000
DEFAULT_CHUNK_OVERLAP = 200
DEFAULT_MODEL_NAME = "BAAI/bge-m3"
PAGE_RE = re.compile(r"\[Page ([\d-]+)\]")
PAGE_PREFIX_RE = re.compile(r"^\s*\[Page [\d-]+\]\s*")
INSTALL_HINT = (
    "python3 -m pip install langchain langchain-text-splitters langchain-chroma "
    "langchain-huggingface torch sentence-transformers chromadb"
)


logger = logging.getLogger(__name__)


def configure_logging() -> None:
    """配置统一日志格式，便于观察长流程中的每一步状态。"""

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def parse_args() -> argparse.Namespace:
    """解析命令行参数，保持脚本默认值足够开箱即用。"""

    parser = argparse.ArgumentParser(
        description="Parse structured course Markdown files and store chunks in ChromaDB."
    )
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        "--input",
        help="Parse one Markdown file instead of the default course_data directory.",
    )
    input_group.add_argument(
        "--input-dir",
        default=DEFAULT_INPUT_DIR,
        help=f"Markdown directory to parse recursively. Defaults to {DEFAULT_INPUT_DIR!r}.",
    )
    parser.add_argument(
        "--persist-dir",
        default=DEFAULT_PERSIST_DIR,
        help=f"ChromaDB persistence directory. Defaults to {DEFAULT_PERSIST_DIR!r}.",
    )
    parser.add_argument(
        "--collection-name",
        default=DEFAULT_COLLECTION_NAME,
        help=f"Chroma collection name. Defaults to {DEFAULT_COLLECTION_NAME!r}.",
    )
    parser.add_argument(
        "--batch-size",
        type=positive_int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Documents per Chroma write batch. Defaults to {DEFAULT_BATCH_SIZE}.",
    )
    parser.add_argument(
        "--chunk-size",
        type=positive_int,
        default=DEFAULT_CHUNK_SIZE,
        help=f"Recursive text chunk size. Defaults to {DEFAULT_CHUNK_SIZE}.",
    )
    parser.add_argument(
        "--chunk-overlap",
        type=non_negative_int,
        default=DEFAULT_CHUNK_OVERLAP,
        help=f"Recursive text chunk overlap. Defaults to {DEFAULT_CHUNK_OVERLAP}.",
    )
    return parser.parse_args()


def positive_int(value: str) -> int:
    """校验必须为正整数的 CLI 参数。"""

    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("value must be a positive integer")
    return parsed


def non_negative_int(value: str) -> int:
    """校验允许为 0 但不能为负数的 CLI 参数。"""

    parsed = int(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("value must be a non-negative integer")
    return parsed


def resolve_repo_path(path_value: str) -> Path:
    """将相对路径稳定解析到当前工作目录或仓库根目录下。"""

    path = Path(path_value).expanduser()
    if path.is_absolute():
        return path.resolve()

    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists():
        return cwd_candidate

    repo_candidate = (Path(__file__).resolve().parents[1] / path).resolve()
    return repo_candidate


def resolve_output_path(path_value: str) -> Path:
    """解析输出目录；相对路径默认落在执行脚本时的当前工作目录。"""

    path = Path(path_value).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (Path.cwd() / path).resolve()


def repo_root() -> Path:
    """返回仓库根目录，供 source metadata 和稳定 ID 使用。"""

    return Path(__file__).resolve().parents[1]


def load_langchain_backends() -> tuple[type[Any], type[Any], type[Any], type[Any], type[Any]] | None:
    """集中加载 LangChain 相关依赖，缺包时给出清晰安装提示并优雅退出。"""

    missing: list[str] = []

    try:
        from langchain_chroma import Chroma
    except ImportError:
        Chroma = None
        missing.append("langchain-chroma")

    try:
        from langchain_core.documents import Document
    except ImportError:
        Document = None
        missing.append("langchain")

    try:
        from langchain_huggingface import HuggingFaceEmbeddings
    except ImportError:
        HuggingFaceEmbeddings = None
        missing.append("langchain-huggingface")

    try:
        from langchain_text_splitters import MarkdownHeaderTextSplitter
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        MarkdownHeaderTextSplitter = None
        RecursiveCharacterTextSplitter = None
        missing.append("langchain-text-splitters")

    try:
        import chromadb  # noqa: F401  # type: ignore[import-not-found]
    except ImportError:
        missing.append("chromadb")

    try:
        import sentence_transformers  # noqa: F401  # type: ignore[import-not-found]
    except ImportError:
        missing.append("sentence-transformers")

    if missing:
        logger.error("缺少必需依赖：%s", ", ".join(sorted(set(missing))))
        logger.error("请安装：%s", INSTALL_HINT)
        return None

    return (
        Chroma,
        Document,
        HuggingFaceEmbeddings,
        MarkdownHeaderTextSplitter,
        RecursiveCharacterTextSplitter,
    )


def load_torch() -> Any | None:
    """加载 torch；设备探测和 embedding 模型都依赖它。"""

    try:
        import torch
    except ImportError:
        logger.error("缺少必需依赖：torch")
        logger.error("请安装：%s", INSTALL_HINT)
        return None
    return torch


def detect_device(torch: Any) -> str:
    """按 cuda -> mps -> cpu 的优先级自动选择 embedding 计算设备。"""

    if torch.cuda.is_available():
        device = "cuda"
    elif getattr(getattr(torch, "backends", None), "mps", None) is not None and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    logger.info("当前 Embedding 硬件设备：%s", device)
    return device


def read_markdown_file(input_path: Path) -> str | None:
    """读取 Markdown 文件；文件不存在或不可读时不抛出堆栈给用户。"""

    if not input_path.exists():
        logger.error("找不到 Markdown 文件：%s", input_path)
        return None
    if not input_path.is_file():
        logger.error("输入路径不是文件：%s", input_path)
        return None
    if input_path.suffix.lower() != ".md":
        logger.error("输入文件不是 Markdown 文件：%s", input_path)
        return None

    try:
        return input_path.read_text(encoding="utf-8-sig")
    except OSError as exc:
        logger.error("读取 Markdown 文件失败：%s；原因：%s", input_path, exc)
        return None


def find_markdown_files(input_dir: Path) -> list[Path] | None:
    """扫描目录下所有 Markdown 文件，按路径稳定排序。"""

    if not input_dir.exists():
        logger.error("找不到 Markdown 目录：%s", input_dir)
        return None
    if not input_dir.is_dir():
        logger.error("输入路径不是目录：%s", input_dir)
        return None

    markdown_files = sorted(input_dir.rglob("*.md"), key=lambda path: path.as_posix())
    logger.info("发现 Markdown 文件数量：%d", len(markdown_files))
    return markdown_files


def split_by_markdown_headers(markdown_text: str, splitter_cls: type[Any]) -> list[Any]:
    """用 #/##/### 标题层级切块，并把层级写入 metadata。"""

    headers_to_split_on = [
        ("#", "Course"),
        ("##", "Section"),
        ("###", "Topic"),
    ]
    splitter = splitter_cls(headers_to_split_on=headers_to_split_on, strip_headers=True)
    chunks = splitter.split_text(markdown_text)
    logger.info("Markdown 标题切块数量：%d", len(chunks))
    return chunks


def clean_page_metadata(chunks: Iterable[Any]) -> list[Any]:
    """提取 Section 中的页码，同时清洗 Section 标题里的 [Page X] 前缀。"""

    cleaned_chunks: list[Any] = []

    for doc in chunks:
        metadata = dict(doc.metadata)
        section = metadata.get("Section")

        if isinstance(section, str):
            page_match = PAGE_RE.search(section)
            if page_match:
                metadata["page"] = page_match.group(1)
            metadata["Section"] = PAGE_PREFIX_RE.sub("", section).strip()

        doc.metadata = metadata
        cleaned_chunks.append(doc)

    return cleaned_chunks


def split_oversized_chunks(
    chunks: list[Any],
    splitter_cls: type[Any],
    chunk_size: int,
    chunk_overlap: int,
) -> list[Any]:
    """对标题切出的超长块再做递归字符切分，并继承原始 metadata。"""

    if chunk_overlap >= chunk_size:
        raise ValueError("--chunk-overlap must be smaller than --chunk-size")

    splitter = splitter_cls(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    split_chunks = splitter.split_documents(chunks)
    logger.info("递归切分后块数量：%d", len(split_chunks))
    return split_chunks


def build_knowledge_path(metadata: dict[str, Any]) -> str:
    """从 metadata 里组装 Course > Section > Topic 知识节点路径。"""

    path_parts: list[str] = []
    for key in ("Course", "Section", "Topic"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            path_parts.append(value.strip())
    return " > ".join(path_parts)


def inject_knowledge_context(chunks: Iterable[Any]) -> list[Any]:
    """把清洗后的标题层级反向注入正文开头，提升 RAG 召回时的上下文完整度。"""

    injected_chunks: list[Any] = []

    for doc in chunks:
        original_content = doc.page_content.strip()

        # 如果标题切块产生了空正文，不能只靠知识节点前缀把它伪装成有效文本。
        # 这里保留为空字符串，交给后续空文本过滤统一剔除。
        if not original_content:
            doc.page_content = ""
            injected_chunks.append(doc)
            continue

        knowledge_path = build_knowledge_path(doc.metadata)
        doc.page_content = f"[知识节点: {knowledge_path}]\n\n{original_content}"
        injected_chunks.append(doc)

    return injected_chunks


def filter_empty_chunks(chunks: list[Any]) -> list[Any]:
    """过滤空文本块，避免无意义文本进入 embedding 模型和向量库。"""

    before_count = len(chunks)
    filtered_chunks = [doc for doc in chunks if doc.page_content.strip()]
    removed_count = before_count - len(filtered_chunks)
    logger.info("空文本过滤后块数量：%d（移除 %d 个空块）", len(filtered_chunks), removed_count)
    return filtered_chunks


def relative_source_path(input_path: Path, root: Path) -> str:
    """将文件路径转成稳定的仓库相对路径。"""

    try:
        return input_path.resolve().relative_to(root).as_posix()
    except ValueError:
        return input_path.resolve().as_posix()


def attach_source_metadata(chunks: list[Any], source: str) -> list[Any]:
    """为每个 Document 写入来源文件路径，方便 RAG 结果回溯到课程数据。"""

    for doc in chunks:
        metadata = dict(doc.metadata)
        metadata["source"] = source
        doc.metadata = metadata
    return chunks


def generate_stable_ids(source: str, chunks: list[Any]) -> list[str]:
    """基于来源相对路径和最终块序号生成稳定 ID，避免同名文件互相覆盖。"""

    return [f"{source}:{index:05d}" for index, _ in enumerate(chunks)]


def batched(items: list[Any], batch_size: int) -> Iterable[tuple[int, list[Any]]]:
    """按固定批次切分列表，返回批次起始下标和批次内容。"""

    for start in range(0, len(items), batch_size):
        yield start, items[start : start + batch_size]


def write_documents_to_chroma(
    chunks: list[Any],
    ids: list[str],
    chroma_cls: type[Any],
    embeddings_cls: type[Any],
    persist_dir: Path,
    collection_name: str,
    batch_size: int,
    device: str,
) -> None:
    """加载 embedding 模型，并将最终 Document 按批次写入持久化 ChromaDB。"""

    logger.info("加载本地 Embedding 模型：%s", DEFAULT_MODEL_NAME)
    embeddings = embeddings_cls(
        model_name=DEFAULT_MODEL_NAME,
        model_kwargs={"device": device},
        encode_kwargs={"normalize_embeddings": True},
    )

    logger.info("初始化 Chroma collection=%s persist_dir=%s", collection_name, persist_dir)
    vector_store = chroma_cls(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=str(persist_dir),
    )

    total = len(chunks)
    for start, batch_docs in batched(chunks, batch_size):
        batch_ids = ids[start : start + len(batch_docs)]

        # 最新 langchain-chroma 在指定 persist_directory 后会自动落盘。
        # 这里显式传入 ids，使重复运行同一文件时按稳定 ID 更新，而不是重复插入。
        vector_store.add_documents(documents=batch_docs, ids=batch_ids)
        logger.info(
            "Chroma 批次写入完成：%d-%d / %d",
            start + 1,
            start + len(batch_docs),
            total,
        )


def reset_chroma_directory(persist_dir: Path) -> None:
    """重建前删除旧 Chroma 目录，避免历史 collection 或旧 ID 混入新结果。"""

    if persist_dir.exists():
        if not persist_dir.is_dir():
            raise RuntimeError(f"Chroma 持久化路径已存在且不是目录：{persist_dir}")
        logger.info("清空旧 ChromaDB 目录：%s", persist_dir)
        shutil.rmtree(persist_dir)


def log_sample_documents(chunks: list[Any], sample_count: int = 2) -> None:
    """打印前几个最终入库块，便于直接核对 page_content 和 metadata。"""

    for index, doc in enumerate(chunks[:sample_count], start=1):
        logger.info(
            "最终 Document 样例 %d\npage_content:\n%s\nmetadata:\n%s",
            index,
            doc.page_content,
            doc.metadata,
        )


def build_documents(
    markdown_text: str,
    markdown_splitter_cls: type[Any],
    recursive_splitter_cls: type[Any],
    chunk_size: int,
    chunk_overlap: int,
) -> list[Any]:
    """串联标题切块、页码清洗、超长块切分、上下文注入和空文本过滤。"""

    chunks = split_by_markdown_headers(markdown_text, markdown_splitter_cls)
    chunks = clean_page_metadata(chunks)
    chunks = split_oversized_chunks(chunks, recursive_splitter_cls, chunk_size, chunk_overlap)
    chunks = inject_knowledge_context(chunks)
    chunks = filter_empty_chunks(chunks)
    return chunks


def build_documents_from_files(
    markdown_files: list[Path],
    root: Path,
    markdown_splitter_cls: type[Any],
    recursive_splitter_cls: type[Any],
    chunk_size: int,
    chunk_overlap: int,
) -> tuple[list[Any], list[str]]:
    """批量读取 Markdown 文件，合并所有最终 Document 和对应稳定 ID。"""

    all_chunks: list[Any] = []
    all_ids: list[str] = []

    for markdown_path in markdown_files:
        source = relative_source_path(markdown_path, root)
        logger.info("处理 Markdown：%s", source)
        markdown_text = read_markdown_file(markdown_path)
        if markdown_text is None:
            raise RuntimeError(f"读取 Markdown 失败：{markdown_path}")

        chunks = build_documents(
            markdown_text=markdown_text,
            markdown_splitter_cls=markdown_splitter_cls,
            recursive_splitter_cls=recursive_splitter_cls,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        chunks = attach_source_metadata(chunks, source)
        ids = generate_stable_ids(source, chunks)
        all_chunks.extend(chunks)
        all_ids.extend(ids)

    logger.info("全部 Markdown 最终入库块数量：%d", len(all_chunks))
    return all_chunks, all_ids


def main() -> int:
    """主流程：读取 Markdown，构建 Document，向量化并持久化到 ChromaDB。"""

    configure_logging()
    args = parse_args()

    root = repo_root()
    persist_dir = resolve_output_path(args.persist_dir)
    logger.info("ChromaDB 持久化目录：%s", persist_dir)

    if args.input:
        input_path = resolve_repo_path(args.input)
        logger.info("输入 Markdown 文件：%s", input_path)
        markdown_files = [input_path]
    else:
        input_dir = resolve_repo_path(args.input_dir)
        logger.info("输入 Markdown 目录：%s", input_dir)
        found_files = find_markdown_files(input_dir)
        if found_files is None:
            return 1
        markdown_files = found_files

    if not markdown_files:
        logger.error("没有找到可处理的 Markdown 文件")
        return 1

    backends = load_langchain_backends()
    if backends is None:
        return 1

    torch = load_torch()
    if torch is None:
        return 1

    (
        chroma_cls,
        _document_cls,
        embeddings_cls,
        markdown_splitter_cls,
        recursive_splitter_cls,
    ) = backends

    try:
        device = detect_device(torch)
        chunks, ids = build_documents_from_files(
            markdown_files=markdown_files,
            root=root,
            markdown_splitter_cls=markdown_splitter_cls,
            recursive_splitter_cls=recursive_splitter_cls,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
        )
        if not chunks:
            logger.error("没有可入库的有效文本块")
            return 1

        reset_chroma_directory(persist_dir)
        write_documents_to_chroma(
            chunks=chunks,
            ids=ids,
            chroma_cls=chroma_cls,
            embeddings_cls=embeddings_cls,
            persist_dir=persist_dir,
            collection_name=args.collection_name,
            batch_size=args.batch_size,
            device=device,
        )
        log_sample_documents(chunks)
        logger.info("向量库构建完成：documents=%d collection=%s", len(chunks), args.collection_name)
        return 0
    except ValueError as exc:
        logger.error("参数错误：%s", exc)
        return 1
    except Exception as exc:
        logger.exception("构建 ChromaDB 向量库失败：%s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
