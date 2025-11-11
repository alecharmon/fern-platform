import json
from pathlib import Path
from typing import Any


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def save_json(path: Path, data: Any) -> None:
    ensure_directory(path.parent)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


def load_json(path: Path) -> Any:
    with open(path) as f:
        return json.load(f)


def load_json_files(directory: Path, pattern: str = "*.json") -> list[Any]:
    if not directory.exists():
        return []

    results = []
    for file_path in sorted(directory.glob(pattern)):
        try:
            results.append(load_json(file_path))
        except Exception as e:
            print(f"Warning: Failed to load {file_path}: {e}")
    return results


def get_suite_paths(suite_name: str, base_path: Path) -> dict[str, Path]:
    suite_path = base_path / suite_name
    return {
        "suite": suite_path,
        "endpoints": suite_path / "endpoints",
        "questions": suite_path / "questions",
    }


def ensure_suite_directories(suite_name: str, base_path: Path) -> dict[str, Path]:
    paths = get_suite_paths(suite_name, base_path)
    for path in paths.values():
        ensure_directory(path)
    return paths
