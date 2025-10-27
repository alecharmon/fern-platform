from fastapi import HTTPException
from pydantic import BaseModel

from fai.app import fai_app
from fai.settings import LOGGER
from fai.utils.slack.client import send_slack_message
from fai.utils.slack.edit_handler import store_editing_session_for_thread
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


class ScribeEditCallbackRequest(BaseModel):
    editing_id: str
    pr_url: str | None = None


class ScribeEditCallbackResponse(BaseModel):
    status: str
    status_code: int


@fai_app.post(
    "/scribe/callback/slack/edit/{team_id}/{channel_id}/{thread_ts}",
    response_model=ScribeEditCallbackResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def scribe_edit_callback(
    team_id: str, channel_id: str, thread_ts: str, request: ScribeEditCallbackRequest
) -> ScribeEditCallbackResponse:
    try:
        LOGGER.info(
            f"Received edit callback for thread {thread_ts} with editing_id: {request.editing_id} "
            f"(team: {team_id}, channel: {channel_id}, pr_url: {request.pr_url})"
        )

        try:
            await store_editing_session_for_thread(team_id, channel_id, thread_ts, request.editing_id)
        except Exception as store_error:
            LOGGER.error(f"Error storing editing session for thread {thread_ts}: {store_error}", exc_info=True)

        integration = await get_slack_integration(team_id)
        if not integration or not integration.slack_bot_token:
            LOGGER.error(f"No Slack integration or bot token found for team {team_id}")
            raise HTTPException(status_code=404, detail="Slack integration not found")

        if request.pr_url:
            message_text = f"✅ Edit complete! PR created: {request.pr_url}"
        else:
            message_text = "✅ Edit session completed successfully!"

        success = await send_slack_message(
            channel=channel_id,
            text=message_text,
            bot_token=integration.slack_bot_token,
            thread_ts=thread_ts,
        )

        if not success:
            LOGGER.error(f"Failed to send message to Slack thread {thread_ts}")
            raise HTTPException(status_code=500, detail="Failed to send Slack message")

        return ScribeEditCallbackResponse(
            status="success",
            status_code=200,
        )

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.error(f"Error handling edit callback for thread {thread_ts}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process edit callback")
