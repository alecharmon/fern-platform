import logging
import os
from pathlib import Path
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    TextBlock,
    ToolUseBlock,
    query,
)

logger = logging.getLogger()


CLAUDE_ANSWER_CODE_QUESTION_USER_PROMPT = """
You are given a question who's answer might lie in one of the code repositories and your job is to answer it.

Process:
- Analyze the question and determine which repository or repositories are relevant to the question.
- Use the relevant repositories to answer the question to the best of your ability.

Guidelines:
- Keep answers as concise as possible while providing all the necessary details to unblock the user.
- Be sure to provide a balance of code examples and text explanations to keep answers engaging and easy to follow.
- Refrain from providing `full working examples` (only snippets/excerpts to support text steps)

Question: {question}
"""

async def run_code_search_tool_call(domain: str, question: str, session_id: str | None = None) -> dict[str, Any]:
    """Run a code search tool call for a domain.

    Args:
        domain: The domain to search code for

    Returns:
        Dictionary with search results
    """
    logger.info(f"Running code search for domain: {domain}")

    efs_root = Path(os.environ.get("HOME", "/mnt/efs"))
    domain_folder = efs_root / domain

    answer = None

    async for message in query(
        prompt=CLAUDE_ANSWER_CODE_QUESTION_USER_PROMPT.format(question=question),
        options=ClaudeAgentOptions(
            cwd=str(domain_folder),
            disallowed_tools=["Write", "Delete", "Rename"],
            resume=session_id,
            fork_session=True
        )
    ):
        if hasattr(message, 'subtype') and message.subtype == 'init':
            session_id = message.data.get('session_id')
            print(f"Session started with ID: {session_id}")

        if isinstance(message, AssistantMessage):
            for content in message.content:
                if isinstance(content, ToolUseBlock):
                    print(f"Tool used: {content.name}")
                    print(f"Tool input: {content.input}")
                if isinstance(content, TextBlock):
                    print(f"Text: {content.text}")
                    answer = content.text


    return {
        "domain": domain,
        "status": "success",
        "answer": answer,
    }
