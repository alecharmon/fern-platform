"""C++ project detection and configuration."""

from pathlib import Path

from src.exceptions import ProjectDetectionError


def detect_project(repo_path: Path, package_path: str | None = None) -> Path:
    """Detect the C++ project root directory."""
    if package_path:
        # Prevent path traversal
        if ".." in package_path or package_path.startswith("/"):
            raise ProjectDetectionError(
                "Invalid package path: must not contain path traversal sequences",
                {"package_path": package_path},
            )
        root = (repo_path / package_path).resolve()
        # Ensure resolved path stays inside the repo.
        # Use Path.relative_to() instead of string prefix matching to avoid
        # false positives (e.g. /tmp/repo vs /tmp/repo-other).
        try:
            root.relative_to(repo_path.resolve())
        except ValueError:
            raise ProjectDetectionError(
                "Invalid package path: resolves outside repository",
                {"package_path": package_path},
            )
        if not root.exists():
            raise ProjectDetectionError(
                f"Specified package path does not exist: {package_path}",
                {"repo_path": str(repo_path), "package_path": package_path},
            )
    else:
        root = repo_path
    return root
