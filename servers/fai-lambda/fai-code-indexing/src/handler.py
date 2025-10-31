import asyncio
import json
import logging
from datetime import (
    UTC,
    datetime,
)
from typing import (
    Any,
    Literal,
)

from shared.utils.validation import validate_body_param_or_throw

from .operations import (
    run_code_search_tool_call,
    setup_repos_for_domain,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Lambda handler for code indexing."""
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {context}")

    try:
        body = json.loads(event.get("body", "{}"))
        domain = validate_body_param_or_throw(body, "domain")
        event_type: Literal["codeSearch", "indexRepo"] = validate_body_param_or_throw(body, "eventType")

        if event_type == "indexRepo":
            repo_urls = validate_body_param_or_throw(body, "repoUrls", list[str])
            asyncio.run(setup_repos_for_domain(domain=domain, repo_urls=repo_urls))

            response_body = {
                "message": f"Successfully indexed {len(repo_urls)} repositories",
                "timestamp": datetime.now(UTC).isoformat(),
                "requestId": context.aws_request_id,
            }

        elif event_type == "codeSearch":
            question = validate_body_param_or_throw(body, "question")
            session_id = body.get("sessionId")
            result = asyncio.run(run_code_search_tool_call(domain=domain, question=question, session_id=session_id))

            response_body = {
                "message": "Code search completed successfully",
                "timestamp": datetime.now(UTC).isoformat(),
                "requestId": context.aws_request_id,
                "answer": result.get("answer", None),
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
