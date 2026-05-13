#!/usr/bin/env python3
"""Convert weekly course slide PDFs into per-page WebP images."""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Iterable, Optional


DEFAULT_SOURCE_DIR = "course_slide"
DEFAULT_DPI = 144
DEFAULT_QUALITY = 90
INSTALL_HINT = "python3 -m pip install pymupdf pillow"
WEEK_DIR_RE = re.compile(r"^week(\d+)$", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Render PDFs under course_slide/week*/ into WebP images in sibling "
            "folders named after each PDF."
        )
    )
    parser.add_argument(
        "--source-dir",
        default=DEFAULT_SOURCE_DIR,
        help=f"Root slide directory to scan. Defaults to {DEFAULT_SOURCE_DIR!r}.",
    )
    parser.add_argument(
        "--dpi",
        type=positive_int,
        default=DEFAULT_DPI,
        help=f"Render DPI. Defaults to {DEFAULT_DPI}, equivalent to 2x PDF scale.",
    )
    parser.add_argument(
        "--quality",
        type=webp_quality,
        default=DEFAULT_QUALITY,
        help=f"WebP quality from 1 to 100. Defaults to {DEFAULT_QUALITY}.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Delete and rebuild existing output folders.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned conversions without rendering images.",
    )
    return parser.parse_args()


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("value must be a positive integer")
    return parsed


def webp_quality(value: str) -> int:
    parsed = int(value)
    if not 1 <= parsed <= 100:
        raise argparse.ArgumentTypeError("quality must be between 1 and 100")
    return parsed


def resolve_source_dir(source_dir: str) -> Path:
    path = Path(source_dir).expanduser()
    if path.is_absolute():
        return path.resolve()

    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists():
        return cwd_candidate

    repo_candidate = (Path(__file__).resolve().parents[1] / path).resolve()
    return repo_candidate


def find_pdfs(source_dir: Path) -> list[Path]:
    pdfs: list[Path] = []
    for week_dir in source_dir.iterdir():
        if not week_dir.is_dir() or not WEEK_DIR_RE.match(week_dir.name):
            continue
        pdfs.extend(
            path
            for path in week_dir.iterdir()
            if path.is_file() and path.suffix.lower() == ".pdf"
        )
    return sorted(pdfs, key=pdf_sort_key)


def pdf_sort_key(pdf_path: Path) -> tuple[int, str, str]:
    match = WEEK_DIR_RE.match(pdf_path.parent.name)
    week_number = int(match.group(1)) if match else 10_000
    return (week_number, pdf_path.parent.name.casefold(), pdf_path.name.casefold())


def load_render_backend():
    missing: list[str] = []

    try:
        import fitz  # type: ignore[import-not-found]
    except ImportError:
        fitz = None
        missing.append("pymupdf")

    try:
        import PIL  # noqa: F401  # type: ignore[import-not-found]
    except ImportError:
        missing.append("pillow")

    if missing:
        print(
            "Missing required package(s): "
            + ", ".join(missing)
            + f"\nInstall them with: {INSTALL_HINT}",
            file=sys.stderr,
        )
        return None

    if not hasattr(fitz, "open") or not hasattr(fitz, "Matrix"):
        print(
            "The imported 'fitz' module does not look like PyMuPDF.\n"
            f"Please install PyMuPDF with: {INSTALL_HINT}",
            file=sys.stderr,
        )
        return None

    return fitz


def describe_plan(pdf_paths: Iterable[Path], overwrite: bool) -> None:
    mode = "overwrite" if overwrite else "skip existing"
    print(f"Dry run mode: {mode}")
    for pdf_path in pdf_paths:
        output_dir = output_dir_for(pdf_path)
        action = "convert"
        if output_dir.exists() and not overwrite:
            action = "skip"
        print(f"[{action}] {pdf_path} -> {output_dir}")


def output_dir_for(pdf_path: Path) -> Path:
    return pdf_path.with_suffix("")


def convert_pdf(pdf_path: Path, fitz, dpi: int, quality: int, overwrite: bool) -> Optional[int]:
    output_dir = output_dir_for(pdf_path)

    if output_dir.exists():
        if not output_dir.is_dir():
            raise RuntimeError(f"output path exists and is not a directory: {output_dir}")
        if not overwrite:
            print(f"[skip] {pdf_path} -> {output_dir} already exists")
            return None

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix=f".{pdf_path.stem}.",
            suffix=".tmp",
            dir=pdf_path.parent,
        )
    )
    moved_temp_dir = False

    try:
        page_count = render_pdf_to_dir(
            pdf_path=pdf_path,
            output_dir=temp_dir,
            fitz=fitz,
            dpi=dpi,
            quality=quality,
        )

        if output_dir.exists():
            shutil.rmtree(output_dir)
        temp_dir.rename(output_dir)
        moved_temp_dir = True
        return page_count
    finally:
        if not moved_temp_dir and temp_dir.exists():
            shutil.rmtree(temp_dir)


def render_pdf_to_dir(pdf_path: Path, output_dir: Path, fitz, dpi: int, quality: int) -> int:
    scale = dpi / 72
    matrix = fitz.Matrix(scale, scale)

    with fitz.open(pdf_path) as document:
        page_count = document.page_count
        digits = max(3, len(str(page_count)))
        for index, page in enumerate(document, start=1):
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image_path = output_dir / f"page_{index:0{digits}d}.webp"
            pixmap.pil_save(str(image_path), format="WEBP", quality=quality)

    return page_count


def main() -> int:
    args = parse_args()
    source_dir = resolve_source_dir(args.source_dir)

    if not source_dir.exists() or not source_dir.is_dir():
        print(f"Source directory does not exist: {source_dir}", file=sys.stderr)
        return 1

    pdf_paths = find_pdfs(source_dir)
    print(f"Found {len(pdf_paths)} PDF(s) under {source_dir}", flush=True)

    if not pdf_paths:
        return 0

    if args.dry_run:
        describe_plan(pdf_paths, args.overwrite)
        return 0

    fitz = load_render_backend()
    if fitz is None:
        return 1

    converted = 0
    skipped = 0
    failed = 0

    for pdf_path in pdf_paths:
        try:
            page_count = convert_pdf(
                pdf_path=pdf_path,
                fitz=fitz,
                dpi=args.dpi,
                quality=args.quality,
                overwrite=args.overwrite,
            )
        except Exception as exc:  # pragma: no cover - depends on local PDFs.
            failed += 1
            print(f"[error] {pdf_path}: {exc}", file=sys.stderr)
            continue

        if page_count is None:
            skipped += 1
        else:
            converted += 1
            print(f"[done] {pdf_path} -> {output_dir_for(pdf_path)} ({page_count} pages)")

    print(f"Summary: converted={converted}, skipped={skipped}, failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
