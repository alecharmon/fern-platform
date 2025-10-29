import logging

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)
from shared.utils.git import configure_git_auth

logger = logging.getLogger()


async def run_indexing_session(
    repo_path: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    """Run a Claude Agent session for code indexing.

    Args:
        repo_path: Path to the cloned repository
        system_prompt: System prompt for the Claude Agent
        user_prompt: User prompt describing the indexing task

    Returns:
        Session ID from Claude Agent
    """
    configure_git_auth(repo_path)

    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Bash", "Glob", "Grep"],
        permission_mode="acceptAll",
        system_prompt=system_prompt,
        cwd=repo_path,
        max_turns=30,
    )

    session_id = None

    async with ClaudeSDKClient(options=options) as client:
        await client.query(user_prompt)

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        logger.info(f"Claude: {block.text}")
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

    return session_id
