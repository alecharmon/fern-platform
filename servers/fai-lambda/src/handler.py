import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any

from .utils.agent import run_agent_on_session_repo
from .utils.validation import validate_body_param_or_throw

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {context}")

    try:
        efs_mount_path = os.environ.get("EFS_MOUNT_PATH", "/mnt/efs")

        if not os.path.exists(efs_mount_path):
            raise RuntimeError(f"EFS not mounted at {efs_mount_path}")

        body = json.loads(event.get("body", "{}"))

        repository = validate_body_param_or_throw(body, "repository")
        prompt = validate_body_param_or_throw(body, "prompt")
        base_branch = validate_body_param_or_throw(body, "base_branch")

        repo_folder_base_path = f"{efs_mount_path}/repos/base"
        sessions_folder_base_path = f"{efs_mount_path}/repos/sessions"

        result = asyncio.run(
            run_agent_on_session_repo(
                repo_folder_base_path=repo_folder_base_path,
                repository=repository,
                sessions_folder_base_path=sessions_folder_base_path,
                prompt=prompt,
                base_branch=base_branch,
            )
        )

        response_body = {
            "message": "Agent execution completed",
            "timestamp": datetime.utcnow().isoformat() + "Z",
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
            "body": json.dumps({"message": "Error processing request", "error": str(e), "requestId": context.aws_request_id}),
        }
