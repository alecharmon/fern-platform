import asyncio
import json
from datetime import (
    UTC,
    datetime,
)
from typing import Any

import httpx
from shared.utils.validation import validate_body_param_or_throw

from .settings import (
    LOGGER,
    SETTINGS,
)
from .utils.agent import (
    SessionInterruptedError,
    run_editing_session,
)
from .utils.git import setup_editing_repo


async def _post_callback(url: str, data: dict[str, Any]) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(url, json=data, timeout=30.0)


async def handle_editing_request(
    repository: str,
    prompt: str,
    base_branch: str,
    editing_id: str | None = None,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        if editing_id:
            LOGGER.info(f"Fetching existing editing session: {editing_id}")
            response = await client.get(f"{SETTINGS.FAI_API_URL}/editing-sessions/{editing_id}")

            if response.status_code == 404:
                raise ValueError(f"Editing session not found: {editing_id}")
            elif response.status_code != 200:
                raise RuntimeError(f"Failed to fetch editing session: {response.status_code} - {response.text}")

            session_data = response.json()
            session = session_data["editing_session"]
            LOGGER.info(f"Resuming editing session: {editing_id}")
            LOGGER.info(f"Existing Claude session_id: {session.get('session_id')}")
            LOGGER.info(f"Existing PR URL: {session.get('pr_url')}")
            is_new_session = False
        else:
            LOGGER.info(f"Creating new editing session for repository: {repository}")
            response = await client.post(
                f"{SETTINGS.FAI_API_URL}/editing-sessions",
                json={
                    "repository": repository,
                    "base_branch": base_branch,
                },
            )

            if response.status_code != 201:
                raise RuntimeError(f"Failed to create editing session: {response.status_code} - {response.text}")

            session_data = response.json()
            session = session_data["editing_session"]
            editing_id = session["id"]
            LOGGER.info(f"Created new editing session: {editing_id}")
            is_new_session = True

        repo_path = setup_editing_repo(
            repository=session["repository"],
            base_branch=session["base_branch"],
            working_branch=session["working_branch"],
            is_new_session=is_new_session,
            editing_id=editing_id,
        )
        LOGGER.info(f"Repository ready at: {repo_path}")

        try:
            session_id, pr_url = await run_editing_session(
                repo_path=repo_path,
                user_prompt=prompt,
                base_branch=session["base_branch"],
                working_branch=session["working_branch"],
                editing_id=editing_id,
                resume_session_id=session.get("session_id"),
                existing_pr_url=session.get("pr_url"),
            )

            LOGGER.info(f"Updating editing session: {editing_id}")
            LOGGER.info(f"PR URL: {pr_url}")
            response = await client.put(
                f"{SETTINGS.FAI_API_URL}/editing-sessions/{editing_id}",
                json={
                    "session_id": session_id,
                    "pr_url": pr_url,
                },
            )

            if response.status_code != 200:
                LOGGER.error(f"Failed to update editing session: {response.status_code} - {response.text}")
            else:
                LOGGER.info(f"Successfully updated editing session: {editing_id}")

            return {
                "editing_id": editing_id,
                "session_id": session_id,
                "pr_url": pr_url,
                "working_branch": session["working_branch"],
                "status": "success",
            }

        except SessionInterruptedError:
            LOGGER.warning(f"Editing session interrupted: {editing_id}")
            return {
                "editing_id": editing_id,
                "session_id": None,
                "pr_url": None,
                "working_branch": session["working_branch"],
                "status": "interrupted",
            }

        except Exception as e:
            LOGGER.error(f"Error during editing session: {str(e)}", exc_info=True)
            raise


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    LOGGER.info(f"Event: {json.dumps(event)}")
    LOGGER.info(f"Context: {context}")

    try:
        body = json.loads(event.get("body", "{}"))

        repository = validate_body_param_or_throw(body, "repository")
        prompt = validate_body_param_or_throw(body, "prompt")
        base_branch = validate_body_param_or_throw(body, "base_branch")

        editing_id = body.get("editing_id")
        callback_url = body.get("callback_url")

        result = asyncio.run(
            handle_editing_request(
                repository=repository,
                prompt=prompt,
                base_branch=base_branch,
                editing_id=editing_id,
            )
        )

        if callback_url and result.get("status") != "interrupted":
            try:
                callback_data = {
                    "editing_id": result["editing_id"],
                    "pr_url": result.get("pr_url"),
                }
                asyncio.run(_post_callback(callback_url, callback_data))
                LOGGER.info(f"Successfully posted callback to {callback_url}")
            except Exception as callback_error:
                LOGGER.error(f"Failed to post callback: {str(callback_error)}", exc_info=True)
        elif result.get("status") == "interrupted":
            LOGGER.info(f"Skipping callback for interrupted session: {editing_id}")

        response_body = {
            "message": "Editing session completed successfully",
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
        LOGGER.error(f"Error processing request: {str(e)}", exc_info=True)

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
