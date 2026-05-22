import json
from pathlib import Path
from typing import Any


BACKEND_DIR = Path(__file__).resolve().parent
CONFIG_DIR = BACKEND_DIR / "config"


def load_json_config(filename: str) -> dict[str, Any]:
    path = CONFIG_DIR / filename

    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    return data if isinstance(data, dict) else {}
