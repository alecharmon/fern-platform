import logging
import os
from pathlib import Path

import httpx
from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)

from .git import configure_git_auth
from .system_prompts import EDITING_SYSTEM_PROMPT

logger = logging.getLogger()

FAI_API_URL = os.environ.get("FAI_API_URL", "https://fai.buildwithfern.com")


class SessionInterruptedError(Exception):
    """Raised when an editing session is interrupted."""

    pass


async def update_session_status(editing_id: str, status: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.put(f"{FAI_API_URL}/editing-sessions/{editing_id}", json={"status": status})
            if response.status_code == 200:
                logger.info(f"Updated session {editing_id} status to {status}")
                return True
            else:
                logger.warning(f"Failed to update session status: {response.status_code}")
                return False
    except Exception as e:
        logger.warning(f"Error updating session status: {e}")
        return False


async def check_if_interrupted(editing_id: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{FAI_API_URL}/editing-sessions/{editing_id}")
            if response.status_code == 200:
                session_data = response.json()
                return session_data["editing_session"]["status"] == "interrupted"
            else:
                logger.warning(f"Failed to check interrupted status: {response.status_code}")
                return False
    except Exception as e:
        logger.warning(f"Error checking interrupted status: {e}")
        return False


def setup_persistent_claude_storage(repo_path: str) -> None:
    repo_claude_dir = Path(repo_path) / ".claude"
    persistent_claude_dir = Path(os.environ.get("HOME", "/tmp")) / ".claude"

    persistent_claude_dir.mkdir(parents=True, exist_ok=True)

    if repo_claude_dir.exists() or repo_claude_dir.is_symlink():
        if repo_claude_dir.is_symlink():
            repo_claude_dir.unlink()
        elif repo_claude_dir.is_dir():
            import shutil

            shutil.rmtree(repo_claude_dir)
        else:
            repo_claude_dir.unlink()

    repo_claude_dir.symlink_to(persistent_claude_dir)
    logger.info(f"Created symlink: {repo_claude_dir} -> {persistent_claude_dir}")


async def run_editing_session(
    repo_path: str,
    user_prompt: str,
    base_branch: str,
    working_branch: str,
    editing_id: str,
    resume_session_id: str | None = None,
    existing_pr_url: str | None = None,
) -> tuple[str, str | None]:
    setup_persistent_claude_storage(repo_path)
    configure_git_auth(repo_path)

    await update_session_status(editing_id, "active")

    if existing_pr_url:
        full_prompt = f"""{user_prompt}

After making the changes:
1. Stage and commit all changes with a descriptive commit message
2. Push the changes to the existing branch '{working_branch}'
3. The PR at {existing_pr_url} will be automatically updated
4. Output the PR URL on a line starting with "PR_URL: {existing_pr_url}"
"""
    else:
        full_prompt = f"""{user_prompt}

After making the changes:
1. Stage and commit all changes with a descriptive commit message
2. Push the changes to branch '{working_branch}'
3. Create a new PR against '{base_branch}' using: gh pr create --base {base_branch} --title "<title>" --body "<body>"
4. The PR title should be concise (one sentence)
5. The PR description should summarize the changes in Markdown
6. Output the PR URL on a line starting with "PR_URL: "
"""

    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Bash", "Glob", "Grep", "Edit"],
        permission_mode="acceptEdits",
        system_prompt=EDITING_SYSTEM_PROMPT,
        cwd=repo_path,
        max_turns=50,
        resume=resume_session_id,
    )

    session_id = resume_session_id
    pr_url = existing_pr_url

    async with ClaudeSDKClient(options=options) as client:
        await client.query(full_prompt)

        async for message in client.receive_response():
            if await check_if_interrupted(editing_id):
                logger.warning(f"Session interrupted: {editing_id}")
                await update_session_status(editing_id, "waiting")
                raise SessionInterruptedError(f"Editing session {editing_id} was interrupted")

            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        logger.info(f"Claude: {block.text}")
                        for line in block.text.split("\n"):
                            if "PR_URL:" in line:
                                extracted_url = line.split("PR_URL:", 1)[1].strip()
                                if extracted_url:
                                    pr_url = extracted_url
                    if isinstance(block, ToolUseBlock):
                        logger.info(f"Using tool: {block.name}")

            if isinstance(message, ResultMessage):
                session_id = message.session_id
                logger.info(f"Session ID: {session_id}")
                logger.info(f"Turns used: {message.num_turns}")
                if message.total_cost_usd:
                    logger.info(f"Cost: ${message.total_cost_usd}")

    if session_id is None:
        raise RuntimeError("Failed to obtain session ID from Claude")

    await update_session_status(editing_id, "waiting")

    return session_id, pr_url
