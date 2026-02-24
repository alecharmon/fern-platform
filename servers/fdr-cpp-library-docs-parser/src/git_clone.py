"""Git operations for cloning repositories."""


def clone_repo(github_url: str, branch: str | None = None):
    """Clone a GitHub repository to a temporary directory."""
    raise NotImplementedError


def find_package_root(repo_path, package_path: str | None = None):
    """Find the C++ project root in a cloned repository."""
    raise NotImplementedError


def cleanup_repo(repo_path) -> None:
    """Clean up a cloned repository."""
    raise NotImplementedError
