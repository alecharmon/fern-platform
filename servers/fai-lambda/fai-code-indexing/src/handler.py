import asyncio
import json
import logging
import os
from datetime import (
    UTC,
    datetime,
)
from typing import (
    Any,
    Literal,
)

import httpx
from shared.utils.validation import validate_body_param_or_throw

from .operations import (
    analyze_repositories_for_domain,
    index_markdown_for_domain,
    run_code_search_tool_call,
    setup_repos_for_domain,
)
from .operations.execute_command import call_shell_command

logger = logging.getLogger()
logger.setLevel(logging.INFO)


async def _post_callback(url: str, data: dict[str, Any]) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(url, json=data, timeout=30.0)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Lambda handler for code indexing."""
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {context}")

    try:
        body = json.loads(event.get("body", "{}"))
        domain = validate_body_param_or_throw(body, "domain")
        event_type: Literal[
            "codeSearch", "indexRepo", "indexRepoMarkdown", "executeCommand"
        ] = validate_body_param_or_throw(body, "eventType")

        if event_type == "executeCommand":
            command = validate_body_param_or_throw(body, "command")
            working_dir = os.environ.get("HOME", "/mnt/efs")

            try:
                execute_command_result = asyncio.run(call_shell_command(command, working_dir))

                response_body = {
                    "message": "Command executed",
                    "command": command,
                    "stdout": execute_command_result["stdout"],
                    "stderr": execute_command_result["stderr"],
                    "returncode": execute_command_result["returncode"],
                    "timestamp": datetime.now(UTC).isoformat(),
                    "requestId": context.aws_request_id,
                }

            except Exception as cmd_error:
                response_body = {
                    "message": "Command execution failed",
                    "command": command,
                    "error": str(cmd_error),
                    "timestamp": datetime.now(UTC).isoformat(),
                    "requestId": context.aws_request_id,
                }

        elif event_type == "indexRepo":
            repo_urls = validate_body_param_or_throw(body, "repoUrls", list[str])
            callback_url = validate_body_param_or_throw(body, "callbackUrl")
            asyncio.run(setup_repos_for_domain(domain=domain, repo_urls=repo_urls))

            analysis_result = asyncio.run(analyze_repositories_for_domain(domain=domain))
            logger.info(f"Analysis completed for {domain} repositories")

            try:
                callback_data = {
                    "session_id": analysis_result.session_id,
                    "status": analysis_result.status,
                }
                asyncio.run(_post_callback(callback_url, callback_data))
                logger.info(f"Successfully posted callback to {callback_url}")
            except Exception as callback_error:
                logger.error(f"Failed to post callback: {str(callback_error)}", exc_info=True)

            response_body = {
                "message": f"Successfully indexed {len(repo_urls)} repositories",
                "timestamp": datetime.now(UTC).isoformat(),
                "requestId": context.aws_request_id,
                "session_id": analysis_result.session_id,
            }

        elif event_type == "indexRepoMarkdown":
            repo_urls = validate_body_param_or_throw(body, "repoUrls", list[str])
            callback_url = validate_body_param_or_throw(body, "callbackUrl")
            asyncio.run(setup_repos_for_domain(domain=domain, repo_urls=repo_urls))

            indexing_result = asyncio.run(index_markdown_for_domain(domain=domain, repo_urls=repo_urls))
            logger.info(f"Indexing completed for {domain} repositories")
            try:
                callback_data = {
                    "session_id": None,
                    "status": indexing_result.status,
                }
                asyncio.run(_post_callback(callback_url, callback_data))
                logger.info(f"Successfully posted callback to {callback_url}")
            except Exception as callback_error:
                logger.error(f"Failed to post callback: {str(callback_error)}", exc_info=True)

            response_body = {
                "message": f"Indexed markdown for {len(repo_urls)} repositories",
                "timestamp": datetime.now(UTC).isoformat(),
                "requestId": context.aws_request_id,
                "status": indexing_result.status,
            }

        elif event_type == "codeSearch":
            question = validate_body_param_or_throw(body, "question")
            session_id = body.get("sessionId")
            code_search_result = asyncio.run(
                run_code_search_tool_call(domain=domain, question=question, session_id=session_id)
            )

            response_body = {
                "message": "Code search completed successfully",
                "timestamp": datetime.now(UTC).isoformat(),
                "requestId": context.aws_request_id,
                "answer": code_search_result.get("answer", None),
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
