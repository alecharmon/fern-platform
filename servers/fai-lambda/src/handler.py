"""
FAI Scribe Lambda Handler

A simple AWS Lambda handler for FAI Scribe that returns Hello World.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler function for FAI Scribe.

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        API Gateway response
    """
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {context}")

    path = event.get("path", "/")
    method = event.get("httpMethod", "GET")

    try:
        # Check EFS mount
        efs_mount_path = os.environ.get("EFS_MOUNT_PATH", "/mnt/efs")
        efs_status = "mounted" if os.path.exists(efs_mount_path) else "not mounted"

        # Build response
        response_body = {
            "message": "Hello World from fai-scribe!",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "requestId": context.request_id,
            "path": path,
            "method": method,
            "efs_mount_path": efs_mount_path,
            "efs_status": efs_status,
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
            "body": json.dumps({
                "message": "Error processing request",
                "error": str(e),
                "requestId": context.request_id,
            }),
        }
