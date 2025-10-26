import json
import logging

import aioboto3
from botocore.exceptions import ClientError

from fai.settings import VARIABLES
from fai.utils.github_utils import get_repo_from_docs_domain

logger = logging.getLogger(__name__)


async def invoke_fai_lambda_for_docs_update(
    conversation_history: str,
    domain: str,
    base_branch: str = "main",
    team_id: str | None = None,
    channel_id: str | None = None,
    thread_ts: str | None = None,
) -> None:
    """
    Invoke the FAI Lambda function to generate a PR for docs improvements.

    Args:
        conversation_history: The conversation text to use for generating improvements
        domain: The docs domain (e.g., "docs.buildwithfern.com") to resolve the GitHub repo
        base_branch: The base branch to target for the PR (default: "main")
        team_id: Slack team ID for callback
        channel_id: Slack channel ID for callback
        thread_ts: Slack thread timestamp for callback

    Returns:
        None. Invokes Lambda asynchronously and optionally posts results back to Slack.
    """
    if not VARIABLES.FAI_LAMBDA_FUNCTION_NAME:
        logger.warning("FAI_LAMBDA_FUNCTION_NAME not configured. Skipping Lambda invocation.")
        return

    repository = await get_repo_from_docs_domain(domain)
    if not repository:
        logger.warning(
            f"No GitHub repository found for domain '{domain}'. Skipping Lambda invocation. "
            f"Please ensure the domain is registered in FDR with a connected GitHub repository."
        )
        return

    logger.info(f"Resolved domain '{domain}' to repository '{repository}'")

    try:
        session = aioboto3.Session()
        async with session.client("lambda") as lambda_client:
            body_payload = {
                "repository": repository,
                "prompt": f"Let's make the documentation more clear based on this thread: {conversation_history}",
                "base_branch": base_branch,
            }

            if team_id and channel_id and thread_ts:
                callback_url = f"https://fai.buildwithfern.com/scribe/callback/slack/{team_id}/{channel_id}/{thread_ts}"
                body_payload["callback_url"] = callback_url
                logger.info(f"Including callback URL in Lambda invocation: {callback_url}")

            payload = {"body": json.dumps(body_payload)}
            response = await lambda_client.invoke(
                FunctionName=VARIABLES.FAI_LAMBDA_FUNCTION_NAME,
                InvocationType="Event",
                Payload=json.dumps(payload),
            )
            logger.info(
                f"Successfully invoked FAI Lambda for docs update. "
                f"StatusCode: {response.get('StatusCode')}, "
                f"Domain: {domain}, "
                f"Repository: {repository}"
            )

    except ClientError as e:
        logger.error(
            f"Failed to invoke FAI Lambda: {e.response['Error']['Code']} - {e.response['Error']['Message']}",
            exc_info=True,
        )
    except Exception as e:
        logger.error(f"Unexpected error invoking FAI Lambda: {str(e)}", exc_info=True)
