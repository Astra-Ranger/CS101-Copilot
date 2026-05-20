import json
import os
import re
from pathlib import Path
from typing import Optional
from urllib.parse import quote


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_SLIDE_ROOT = PROJECT_ROOT / "course_slide"
PAGE_FILE_RE = re.compile(r"^page_(\d{3})\.webp$", re.IGNORECASE)


class SlideCatalogError(Exception):
    pass


class SlideRootNotFound(SlideCatalogError):
    pass


class CourseNotFound(SlideCatalogError):
    pass


class InvalidSlidePage(SlideCatalogError):
    pass


class SlideNotFound(SlideCatalogError):
    pass


def get_slide_root(slide_root: Optional[Path] = None) -> Path:
    if slide_root is not None:
        root = Path(slide_root)
    else:
        configured_root = os.getenv("COURSE_SLIDE_ROOT")
        root = Path(configured_root) if configured_root else DEFAULT_SLIDE_ROOT

    if not root.is_absolute():
        root = PROJECT_ROOT / root

    root = root.resolve()

    if not root.is_dir():
        raise SlideRootNotFound(f"Slide root does not exist: {root}")

    return root


def natural_key(value: str):
    parts = re.split(r"(\d+)", value)
    return tuple(
        (0, int(part)) if part.isdigit() else (1, part.casefold())
        for part in parts
    )


def page_files(deck_dir: Path):
    pages = []

    for path in deck_dir.iterdir():
        if not path.is_file():
            continue

        match = PAGE_FILE_RE.match(path.name)
        if match:
            pages.append((int(match.group(1)), path))

    return sorted(pages, key=lambda item: item[0])


def scan_courses(slide_root: Optional[Path] = None):
    root = get_slide_root(slide_root)
    courses = []

    for week_dir in sorted(
        (path for path in root.iterdir() if path.is_dir()),
        key=lambda path: natural_key(path.name),
    ):
        for deck_dir in sorted(
            (path for path in week_dir.iterdir() if path.is_dir()),
            key=lambda path: natural_key(path.name),
        ):
            pages = page_files(deck_dir)

            if not pages:
                continue

            course_id = f"{week_dir.name}--{deck_dir.name}"
            relative_parts = deck_dir.relative_to(PROJECT_ROOT).parts

            courses.append(
                {
                    "id": course_id,
                    "week": week_dir.name,
                    "title": deck_dir.name,
                    "pageCount": len(pages),
                    "pathSegments": list(relative_parts),
                    "_deckDir": deck_dir,
                    "_pages": pages,
                }
            )

    return courses


def strip_private_fields(course):
    return {
        "id": course["id"],
        "week": course["week"],
        "title": course["title"],
        "pageCount": course["pageCount"],
        "pathSegments": course["pathSegments"],
    }


def build_aliases(courses):
    week16_course = next(
        (course for course in courses if course["week"].casefold() == "week16"),
        None,
    )

    if not week16_course:
        return {}

    return {"demo-course": week16_course["id"]}


def build_course_index(slide_root: Optional[Path] = None):
    courses = scan_courses(slide_root)

    return {
        "aliases": build_aliases(courses),
        "courses": [strip_private_fields(course) for course in courses],
    }


def resolve_course_id(course_id: str, courses, aliases):
    return aliases.get(course_id, course_id)


def find_course(course_id: str, slide_root: Optional[Path] = None):
    courses = scan_courses(slide_root)
    aliases = build_aliases(courses)
    resolved_course_id = resolve_course_id(course_id, courses, aliases)

    for course in courses:
        if course["id"] == resolved_course_id:
            return course, resolved_course_id

    raise CourseNotFound(f"Course not found: {course_id}")


def build_course_deck(course_id: str, slide_root: Optional[Path] = None):
    course, resolved_course_id = find_course(course_id, slide_root)
    encoded_course_id = quote(course_id, safe="")

    slides = [
        {
            "pageNumber": page_number,
            "title": f"Page {page_number}",
            "imageUrl": f"/api/slides/{encoded_course_id}/pages/{page_number}",
        }
        for page_number, _path in course["_pages"]
    ]

    return {
        "courseId": course_id,
        "resolvedCourseId": resolved_course_id,
        "week": course["week"],
        "title": course["title"],
        "slides": slides,
    }


def ensure_inside_root(path: Path, root: Path) -> None:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError as exc:
        raise SlideNotFound(f"Slide path is outside root: {path}") from exc


def get_slide_page_path(
    course_id: str,
    page_number,
    slide_root: Optional[Path] = None,
) -> Path:
    try:
        normalized_page = int(page_number)
    except (TypeError, ValueError) as exc:
        raise InvalidSlidePage(f"Invalid slide page: {page_number}") from exc

    if normalized_page < 1:
        raise InvalidSlidePage(f"Invalid slide page: {page_number}")

    root = get_slide_root(slide_root)
    course, _resolved_course_id = find_course(course_id, root)

    for current_page, path in course["_pages"]:
        if current_page == normalized_page:
            ensure_inside_root(path, root)
            return path

    raise SlideNotFound(
        f"Slide page {normalized_page} not found for course {course_id}"
    )


def main() -> None:
    print(json.dumps(build_course_index(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
