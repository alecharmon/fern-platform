import logging
import os
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    TextBlock,
    ToolUseBlock,
    query,
)

from ..models import AnalysisResult

logger = logging.getLogger()

CLAUDE_ANALYST_SYSTEM_PROMPT = """
You are an expert code analyst.
"""

CLAUDE_ANALYST_USER_PROMPT = """
You are given a group of code repositories that are all associated with the same company/core product offering.

Your Task:
- Understand the code of each individual repository by exploring its architecture, language, purpose, and usage
- Understand the potential use-cases of each repository

DO NOT modify the code in any way.
"""


async def analyze_repositories_for_domain(domain: str) -> AnalysisResult:
    """Analyze all repositories for a domain.

    Args:
        domain: The domain to analyze repositories for

    Returns:
        Dictionary with analysis results
    """
    logger.info(f"Analyzing repositories for domain: {domain}")

    efs_root = Path(os.environ.get("HOME", "/mnt/efs"))
    domain_folder = efs_root / domain

    if not domain_folder.exists():
        raise ValueError(f"Domain folder does not exist: {domain_folder}")

    session_id: str | None = None

    try:
        async for message in query(
            prompt=CLAUDE_ANALYST_USER_PROMPT,
            options=ClaudeAgentOptions(
                cwd=str(domain_folder),
                system_prompt=CLAUDE_ANALYST_SYSTEM_PROMPT,
                disallowed_tools=["Write", "Delete", "Rename"],
            ),
        ):
            if hasattr(message, "subtype") and message.subtype == "init":
                if hasattr(message, "data") and isinstance(message.data, dict):
                    session_id = message.data.get("session_id")
                    logger.info(f"Session started with ID: {session_id}")

            if isinstance(message, AssistantMessage):
                for content in message.content:
                    if isinstance(content, ToolUseBlock):
                        logger.info(f"Tool used: {content.name}")
                    if isinstance(content, TextBlock):
                        logger.info(f"{content.text}")
    except Exception as e:
        logger.error(f"Failed to analyze repositories for domain {domain}: {e}")
        return AnalysisResult(domain=domain, session_id=None, status="error", error=str(e))

    return AnalysisResult(domain=domain, session_id=session_id, status="success", error=None)
