"""C++ project detection and configuration."""

from pathlib import Path

from src.exceptions import ProjectDetectionError


def detect_project(repo_path: Path, package_path: str | None = None) -> Path:
    """Detect the C++ project root directory."""
    root = repo_path / package_path if package_path else repo_path
    if package_path and not root.exists():
        raise ProjectDetectionError(
            f"Specified package path does not exist: {package_path} (repo_path={repo_path})"
        )
    return root
