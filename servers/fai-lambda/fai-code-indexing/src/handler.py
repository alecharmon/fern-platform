import json
from typing import Any


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Simple hello world handler for fai-code-indexing Lambda."""
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({"message": "Hello World"}),
    }
