import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from .utils.agent import run_agent_on_session_repo
from .utils.validation import validate_body_param_or_throw

logger = logging.getLogger()
logger.setLevel(logging.INFO)


async def _post_callback(url: str, data: dict[str, Any]) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(url, json=data, timeout=30.0)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {context}")

    try:
        body = json.loads(event.get("body", "{}"))

        repository = validate_body_param_or_throw(body, "repository")
        prompt = validate_body_param_or_throw(body, "prompt")
        base_branch = validate_body_param_or_throw(body, "base_branch")
        callback_url = body.get("callback_url") if body.get("callback_url") else None

        result = asyncio.run(
            run_agent_on_session_repo(
                repository=repository,
                prompt=prompt,
                base_branch=base_branch,
            )
        )

        callback_data = {
            "pr_url": result["pr_url"] or ""
        }

        if callback_url:
            try:
                asyncio.run(_post_callback(callback_url, callback_data))
                logger.info(f"Successfully posted callback to {callback_url}")
            except Exception as callback_error:
                logger.error(f"Failed to post callback: {str(callback_error)}", exc_info=True)

        response_body = {
            "message": "Agent execution completed",
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
