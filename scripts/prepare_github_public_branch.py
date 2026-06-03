#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


DEFAULT_OUTPUT = Path("/private/tmp/cs101-copilot-github-public")
DEFAULT_BASE = "github/main"
SILICONFLOW_CONFIG = Path("backend/config/siliconflow_models.json")


def run_git(args: list[str], cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout


def git_visible_files(repo: Path) -> set[Path]:
    output = run_git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], repo)
    files: set[Path] = set()

    for raw_path in output.split("\0"):
        if not raw_path:
            continue

        path = Path(raw_path)
        if (repo / path).is_file():
            files.add(path)

    return files


def copy_working_tree(source: Path, target: Path) -> None:
    desired_files = git_visible_files(source)
    existing_files = git_visible_files(target)

    for stale_file in existing_files - desired_files:
        stale_path = target / stale_file
        if stale_path.exists():
            stale_path.unlink()

    for relative_path in desired_files:
        source_path = source / relative_path
        target_path = target / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)

    remove_empty_dirs(target)


def remove_empty_dirs(root: Path) -> None:
    for path in sorted(root.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if path.is_dir() and path.name != ".git":
            try:
                path.rmdir()
            except OSError:
                pass


def sanitize_siliconflow_config(repo: Path) -> None:
    config_path = repo / SILICONFLOW_CONFIG
    if not config_path.exists():
        return

    data = json.loads(config_path.read_text(encoding="utf-8"))
    providers = data.get("providers", {})

    if isinstance(providers, dict):
        for provider in providers.values():
            if isinstance(provider, dict) and "api_key" in provider:
                provider["api_key"] = ""

    config_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create a GitHub-safe worktree snapshot from the current working tree "
            "while clearing SiliconFlow API keys."
        )
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output worktree path. Default: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--base",
        default=DEFAULT_BASE,
        help=f"Public-safe base ref. Default: {DEFAULT_BASE}",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_repo = Path(run_git(["rev-parse", "--show-toplevel"], Path.cwd()).strip())
    output = args.output.expanduser().resolve()

    if output.exists():
        raise SystemExit(f"Output path already exists: {output}")

    run_git(["worktree", "add", "--detach", str(output), args.base], source_repo)
    copy_working_tree(source_repo, output)
    sanitize_siliconflow_config(output)

    status = run_git(["status", "--short"], output).strip()
    print(f"Prepared GitHub-safe worktree: {output}")
    print("Sanitized: backend/config/siliconflow_models.json")
    print()
    print("Next commands:")
    print(f"  cd {output}")
    print('  git add -A')
    print('  git commit -m "Update public release"')
    print("  git push github HEAD:main")
    print()
    print("Current public worktree status:")
    print(status or "  clean")


if __name__ == "__main__":
    main()
