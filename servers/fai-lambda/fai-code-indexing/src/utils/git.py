from shared.utils.git import clone_repo as shared_clone_repo


def clone_repo(repository: str, session_id: str) -> str:
    """Clone a GitHub repository into /tmp for indexing.

    Args:
        repository: GitHub repository in format 'owner/repo'
        session_id: Unique identifier for this indexing session

    Returns:
        Path to the cloned repository
    """
    return shared_clone_repo(repository=repository, session_id=session_id, session_type="indexing")
