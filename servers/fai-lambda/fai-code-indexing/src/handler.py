import asyncio
import json
import logging
import uuid
from datetime import (
    UTC,
    datetime,
)
from typing import Any

from shared.utils.validation import validate_body_param_or_throw

from .utils.git import clone_repo

logger = logging.getLogger()
logger.setLevel(logging.INFO)

INDEXING_SYSTEM_PROMPT = """You are a code indexing assistant. \
Your task is to analyze code repositories and extract relevant information \
for documentation and search purposes."""


async def handle_indexing_request(
    repository: str,
) -> dict[str, Any]:
    """Handle code indexing request.

    Args:
        repository: GitHub repository in format 'owner/repo'

    Returns:
        Dictionary with indexing results
    """
    session_id = str(uuid.uuid4())
    logger.info(f"Starting indexing session {session_id} for repository: {repository}")

    repo_path = clone_repo(repository=repository, session_id=session_id)
    logger.info(f"Repository cloned to: {repo_path}")

    #     user_prompt = f"""Analyze the codebase at {repo_path} and provide a summary of:
    # 1. Main programming languages used
    # 2. Project structure and key directories
    # 3. Entry points and main files
    # 4. Dependencies and package managers used
    # """

    #     claude_session_id = await run_indexing_session(
    #         repo_path=repo_path,
    #         system_prompt=INDEXING_SYSTEM_PROMPT,
    #         user_prompt=user_prompt,
    #     )

    #     logger.info(f"Indexing session completed: {claude_session_id}")

    return {
        "session_id": session_id,
        # "claude_session_id": claude_session_id,
        "repository": repository,
        "status": "success",
    }


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Lambda handler for code indexing."""
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {context}")

    try:
        body = json.loads(event.get("body", "{}"))
        repository = validate_body_param_or_throw(body, "repository")

        result = asyncio.run(handle_indexing_request(repository=repository))

        response_body = {
            "message": "Indexing completed successfully",
            "timestamp": datetime.now(UTC).isoformat(),
            "requestId": context.aws_request_id,
            "result": result,
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(response_body),
        }

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)

        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "message": "Error processing request",
                    "error": str(e),
                    "requestId": context.aws_request_id,
                }
            ),
        }
