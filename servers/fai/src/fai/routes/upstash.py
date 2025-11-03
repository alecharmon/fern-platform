import logging

from fastapi.responses import JSONResponse

from fai.app import fai_app
from fai.models.api.qstash_failure_callback import (
    QStashFailureCallback,
    QStashFailureCallbackResponse,
)
from fai.settings import VARIABLES
from fai.utils.slack.client import send_slack_message

logger = logging.getLogger(__name__)


@fai_app.post(
    "/upstash/qstash/failure-callback",
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def qstash_failure_callback(body: QStashFailureCallback) -> QStashFailureCallbackResponse:
    """
    Callback endpoint for Upstash QStash to notify about failed requests.
    Logs the failure details and posts to Slack #search-notifs channel.
    """
    try:
        dlq_id = body.dlq_id
        url = body.url
        status = body.status
        source_header = body.source_header

        logger.error(f"Upstash QStash failure callback received: " f"url={url}, status={status}")
        slack_message = (
            f"🚨 *QStash Reindexing Failure*\n"
            f"• *DLQ ID:* `{dlq_id}`\n"
            f"• *Status:* `{status}`\n"
            f"• *URL:* {url}\n"
        )

        if source_header:
            fern_host = source_header.get("X-Fern-Host", None)
            if fern_host:
                slack_message += f"• *Host:* `{fern_host}`\n"

        success = await send_slack_message(
            channel="search-notifs",
            text=slack_message,
            bot_token=VARIABLES.FERNIE_SLACK_BOT_TOKEN,
        )

        return JSONResponse(
            status_code=200,
            content={"success": success},
        )

    except Exception as e:
        logger.error(f"Error processing Upstash failure callback: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)},
        )
