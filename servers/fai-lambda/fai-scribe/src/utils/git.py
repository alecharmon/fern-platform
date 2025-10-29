from shared.utils.git import checkout_or_create_branch, clone_repo


def setup_editing_repo(
    repository: str,
    base_branch: str,
    working_branch: str,
    is_new_session: bool,
    editing_id: str,
) -> str:
    """Setup a repository for editing by cloning and checking out the appropriate branch.

    Args:
        repository: GitHub repository in format 'owner/repo'
        base_branch: Base branch to create the working branch from
        working_branch: Branch to work on
        is_new_session: Whether this is a new editing session
        editing_id: Unique identifier for this editing session

    Returns:
        Path to the cloned repository
    """
    repo_path = clone_repo(repository=repository, session_id=editing_id, session_type="editing")

    checkout_or_create_branch(
        repo_path=repo_path,
        branch_name=working_branch,
        base_branch=base_branch,
        create_new=is_new_session,
    )

    return repo_path
