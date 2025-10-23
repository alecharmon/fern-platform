import logging

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, ToolUseBlock, query

from .git import configure_git_auth, setup_session_repo
from .system_prompts import GIT_PR_SYSTEM_PROMPT, TECHNICAL_WRITER_SYSTEM_PROMPT

logger = logging.getLogger()


async def update_repo_with_agent(repo_path: str, user_prompt: str) -> None:
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Bash"],
        permission_mode="acceptEdits",
        system_prompt=TECHNICAL_WRITER_SYSTEM_PROMPT,
        cwd=repo_path,
        max_turns=50,
    )

    async for message in query(prompt=user_prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    logger.info(block.text)
                if isinstance(block, ToolUseBlock):
                    logger.info(f"Using tool: {block.name}")


async def create_pr_with_agent(repo_path: str, base_branch: str) -> None:
    configure_git_auth(repo_path)

    options = ClaudeAgentOptions(
        allowed_tools=["Bash"],
        permission_mode="acceptEdits",
        system_prompt=GIT_PR_SYSTEM_PROMPT,
        cwd=repo_path,
        max_turns=50,
    )

    prompt = f"""
    You are in a git repository currently on branch '{base_branch}'.

    Your task:
    1. Review the changes that were made (use git diff to see what changed)
    2. Create a new branch with a descriptive name based on the changes
    3. Stage and commit all changes with a descriptive message
    4. Push the new branch to origin
    5. Create a PR against '{base_branch}' with a clear title and description

    IMPORTANT:
    1. The branch name should be descriptive and concise as possible.
    2. The PR title should NOT be more than one sentence long.
    3. The PR description should be formatted in Markdown and provide a clear justification of the changes.
    """

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    logger.info(block.text)
                if isinstance(block, ToolUseBlock):
                    logger.info(f"Using tool: {block.name}")


async def run_agent_on_session_repo(repository: str, prompt: str, base_branch: str = "main") -> dict[str, str]:
    session_repo_path = setup_session_repo(repository, base_branch)
    logger.info(f"Repository cloned to: {session_repo_path}")

    await update_repo_with_agent(session_repo_path, prompt)
    await create_pr_with_agent(session_repo_path, base_branch)

    return {
        "repository": repository,
        "base_branch": base_branch,
        "session_repo_path": session_repo_path,
        "status": "success",
    }
