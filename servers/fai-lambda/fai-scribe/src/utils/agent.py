import re

import httpx
from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)
from shared.utils.agent import setup_persistent_claude_storage
from shared.utils.git import configure_git_auth

from ..settings import (
    LOGGER,
    SETTINGS,
)
from .system_prompts import EDITING_SYSTEM_PROMPT

GITHUB_PR_URL_PATTERN = re.compile(r"(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/]+)/pull/(\d+)", re.IGNORECASE)


class SessionInterruptedError(Exception):
    """Raised when an editing session is interrupted."""

    pass


async def update_session_status(editing_id: str, status: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.put(
                f"{SETTINGS.FAI_API_URL}/editing-sessions/{editing_id}", json={"status": status}
            )
            if response.status_code == 200:
                LOGGER.info(f"Updated session {editing_id} status to {status}")
                return True
            else:
                LOGGER.warning(f"Failed to update session status: {response.status_code}")
                return False
    except Exception as e:
        LOGGER.warning(f"Error updating session status: {e}")
        return False


async def update_session_metadata(editing_id: str, session_id: str | None = None, pr_url: str | None = None) -> bool:
    """Update session metadata (session_id and/or pr_url) immediately when available."""
    try:
        payload = {}
        if session_id is not None:
            payload["session_id"] = session_id
        if pr_url is not None:
            payload["pr_url"] = pr_url

        if not payload:
            return True

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.put(f"{SETTINGS.FAI_API_URL}/editing-sessions/{editing_id}", json=payload)
            if response.status_code == 200:
                LOGGER.info(f"Updated session {editing_id} metadata: {payload}")
                return True
            else:
                LOGGER.warning(f"Failed to update session metadata: {response.status_code}")
                return False
    except Exception as e:
        LOGGER.warning(f"Error updating session metadata: {e}")
        return False


async def check_if_interrupted(editing_id: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{SETTINGS.FAI_API_URL}/editing-sessions/{editing_id}")
            if response.status_code == 200:
                session_data = response.json()
                return session_data["editing_session"]["status"] == "interrupted"
            else:
                LOGGER.warning(f"Failed to check interrupted status: {response.status_code}")
                return False
    except Exception as e:
        LOGGER.warning(f"Error checking interrupted status: {e}")
        return False


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

    if await check_if_interrupted(editing_id):
        LOGGER.warning(f"Session interrupted before starting: {editing_id}")
        await update_session_status(editing_id, "waiting")
        raise SessionInterruptedError(f"Editing session {editing_id} was interrupted")

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

    if resume_session_id:
        LOGGER.info(f"Resuming Claude session: {resume_session_id}")
    else:
        LOGGER.info("Starting new Claude session (no resume_session_id)")

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
            if hasattr(message, "subtype") and message.subtype == "init":
                if hasattr(message, "data") and isinstance(message.data, dict):
                    init_session_id = message.data.get("session_id")
                    if init_session_id and session_id is None:
                        session_id = init_session_id
                        LOGGER.info(f"Captured session_id from init message: {session_id}")
                        await update_session_metadata(editing_id, session_id=session_id)

            if await check_if_interrupted(editing_id):
                LOGGER.warning(f"Session interrupted: {editing_id}")
                await update_session_status(editing_id, "waiting")
                raise SessionInterruptedError(f"Editing session {editing_id} was interrupted")

            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        LOGGER.info(f"Claude: {block.text}")
                        for line in block.text.split("\n"):
                            if "PR_URL:" in line:
                                extracted_text = line.split("PR_URL:", 1)[1].strip()
                                if extracted_text:
                                    match = GITHUB_PR_URL_PATTERN.search(extracted_text)
                                    if match:
                                        pr_url = match.group(0)
                                        LOGGER.info(f"Extracted PR URL: {pr_url}")
                                        await update_session_metadata(editing_id, pr_url=pr_url)
                                    else:
                                        LOGGER.warning(f"Invalid PR URL format: {extracted_text}")
                    if isinstance(block, ToolUseBlock):
                        LOGGER.info(f"Using tool: {block.name}")

            if isinstance(message, ResultMessage):
                session_id = message.session_id
                LOGGER.info(f"Session ID: {session_id}")
                LOGGER.info(f"Turns used: {message.num_turns}")
                if message.total_cost_usd:
                    LOGGER.info(f"Cost: ${message.total_cost_usd}")
    if session_id is None:
        raise RuntimeError("Failed to obtain session ID from Claude")

    await update_session_status(editing_id, "waiting")

    return session_id, pr_url
