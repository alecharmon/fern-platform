from fastapi import HTTPException
from pydantic import BaseModel

from fai.app import fai_app
from fai.settings import LOGGER
from fai.utils.github_utils import get_repo_from_docs_domain
from fai.utils.slack.client import send_slack_message
from fai.utils.slack.message_handler import get_slack_integration


class ScribeSlackCallbackRequest(BaseModel):
    pr_url: str


class ScribeSlackCallbackResponse(BaseModel):
    status: str
    status_code: int


@fai_app.post(
    "/scribe/callback/slack/{team_id}/{channel_id}/{thread_ts}",
    response_model=ScribeSlackCallbackResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def scribe_slack_callback(
    team_id: str, channel_id: str, thread_ts: str, request: ScribeSlackCallbackRequest
) -> ScribeSlackCallbackResponse:
    """
    Callback endpoint for Scribe to post PR URLs back to Slack threads.
    """
    try:
        LOGGER.info(
            f"Received scribe callback for thread {thread_ts} with PR URL: {request.pr_url} "
            f"(team: {team_id}, channel: {channel_id})"
        )

        integration = await get_slack_integration(team_id)
        if not integration or not integration.slack_bot_token:
            LOGGER.error(f"No Slack integration or bot token found for team {team_id}")
            raise HTTPException(status_code=404, detail="Slack integration not found")

        message_text = f"✅ PR with docs improvements from this thread: {request.pr_url}"
        success = await send_slack_message(
            channel=channel_id,
            text=message_text,
            bot_token=integration.slack_bot_token,
            thread_ts=thread_ts,
        )

        if not success:
            LOGGER.error(f"Failed to send message to Slack thread {thread_ts}")
            raise HTTPException(status_code=500, detail="Failed to send Slack message")

        return ScribeSlackCallbackResponse(
            status="success",
            status_code=200,
        )

    except Exception as e:
        LOGGER.error(f"Error handling scribe callback for thread {thread_ts}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process scribe callback")


class DomainRepoResponse(BaseModel):
    domain: str
    repo: str | None


@fai_app.get(
    "/scribe/test/domain-to-repo",
    response_model=DomainRepoResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def test_domain_to_repo(domain: str) -> DomainRepoResponse:
    LOGGER.info(f"Testing domain to repo mapping for domain: {domain}")

    repo = await get_repo_from_docs_domain(domain)

    return DomainRepoResponse(domain=domain, repo=repo)
