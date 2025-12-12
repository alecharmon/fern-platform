from datetime import UTC, datetime
from typing import Any

from fastapi import BackgroundTasks, HTTPException, Request, status
from fastapi.responses import JSONResponse
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select
from sqlalchemy.orm import attributes

from fai.app import fai_app
from fai.db import async_session_maker
from fai.dependencies import verify_org_token
from fai.models.api.scribe_channel_settings import ScribeChannelSettings
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_message_cache_db import ScribeMessageCacheDb
from fai.settings import LOGGER, VARIABLES
from fai.utils.scribe.message_handler import handle_scribe_message
from fai.utils.scribe.validate_github_repo import validate_scribe_github_repo_access
from fai.utils.slack.client import add_reaction
from fai.utils.slack.integration_common import (
    SLACK_SCOPES,
    cleanup_message_cache,
    create_slack_integration_url,
    handle_oauth_callback,
    is_message_processed,
    mark_message_processed,
)
from fai.utils.slack.postprocessing import slackify_markdown


async def cleanup_scribe_message_cache() -> None:
    """Clean up old Scribe message cache entries."""
    await cleanup_message_cache(ScribeMessageCacheDb)


async def is_scribe_message_processed(team_id: str, message_ts: str) -> bool:
    """Check if a Scribe message has already been processed."""
    return await is_message_processed(team_id, message_ts, ScribeMessageCacheDb)


async def mark_scribe_message_processed(team_id: str, message_ts: str) -> None:
    """Mark a Scribe message as processed."""
    await mark_message_processed(team_id, message_ts, ScribeMessageCacheDb, "uq_scribe_message_cache_team_message")


@fai_app.post("/scribe/slack/events", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_scribe_slack_events(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    try:
        body = await request.json()

        if body.get("type") == "url_verification":
            challenge = body.get("challenge")
            if challenge:
                LOGGER.info("[SCRIBE] Slack URL verification challenge received")
                return JSONResponse(content={"challenge": challenge})
            else:
                raise HTTPException(status_code=400, detail="Missing challenge in URL verification")

        if body.get("type") == "event_callback":
            event = body.get("event", {})
            event_type = event.get("type")
            team_id = body.get("team_id")

            if not team_id:
                LOGGER.error("[SCRIBE] Missing team_id in event")
                return JSONResponse(content={"status": "error", "message": "Missing team_id"}, status_code=400)

            LOGGER.info(f"[SCRIBE] Received Slack event: {event_type} from team: {team_id}")

            await cleanup_scribe_message_cache()

            message_ts = event.get("ts")
            if message_ts:
                if await is_scribe_message_processed(team_id, message_ts):
                    LOGGER.info(f"[SCRIBE] Skipping duplicate message: {message_ts}")
                    return JSONResponse(content={"status": "ok"})

            if event_type == "app_mention":
                if event.get("bot_id"):
                    return JSONResponse(content={"status": "ok"})

                if message_ts:
                    await mark_scribe_message_processed(team_id, message_ts)

                background_tasks.add_task(handle_app_mention, event, team_id)
            else:
                LOGGER.info(f"[SCRIBE] Ignoring event type: {event_type} (only app_mention supported)")

            return JSONResponse(content={"status": "ok"})

        LOGGER.warning(f"[SCRIBE] Unknown Slack request type: {body.get('type')}")
        return JSONResponse(content={"status": "ok"})

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error handling Slack event: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def handle_app_mention(event: dict[str, Any], team_id: str) -> None:
    try:
        user = event.get("user")
        text = event.get("text", "")
        channel = event.get("channel")
        message_ts = event.get("ts")

        LOGGER.info(f"[SCRIBE] App mentioned by {user} in {channel}: {text}")

        response = await handle_scribe_message(event, team_id)

        LOGGER.info(
            f"[SCRIBE] handle_scribe_message returned: response_text={bool(response.response_text)}, "
            f"bot_token={bool(response.bot_token)}, channel={response.channel}"
        )

        if response.bot_token and message_ts and channel:
            try:
                await add_reaction(channel, message_ts, "eyes", response.bot_token)
            except Exception as e:
                LOGGER.warning(f"[SCRIBE] Failed to add eyes reaction: {e}")

        if not response.response_text or not response.bot_token:
            LOGGER.info(
                f"[SCRIBE] Not sending message: response_text={bool(response.response_text)}, "
                f"bot_token={bool(response.bot_token)}"
            )
            return

        client = AsyncWebClient(token=response.bot_token)
        try:
            msg_response = await client.chat_postMessage(
                channel=response.channel,
                text=slackify_markdown(response.response_text),
                thread_ts=response.thread_ts,
                unfurl_links=False,
                unfurl_media=False,
            )
            if msg_response["ok"]:
                LOGGER.info("[SCRIBE] Successfully sent response to Slack")
            else:
                LOGGER.error(f"[SCRIBE] Failed to send message: {msg_response}")
        except Exception as e:
            LOGGER.error(f"[SCRIBE] Error sending message: {e}")
    except Exception as e:
        LOGGER.error(f"[SCRIBE] Unhandled exception in handle_app_mention: {e}", exc_info=True)


@fai_app.get(
    "/scribe/slack/get-install", openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]}
)
async def get_fern_writer_install_link(github_repo: str, request: Request) -> JSONResponse:
    try:
        await verify_org_token(request)
        LOGGER.info(f"[SCRIBE] Validating GitHub repo {github_repo}")

        validation_result = await validate_scribe_github_repo_access(github_repo)

        if not validation_result["ok"]:
            error = validation_result["error"]
            LOGGER.warning(f"[SCRIBE] Validation failed for repo {github_repo}: {error['type']} - {error['message']}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error["message"])

        async with async_session_maker() as session:
            new_integration = ScribeIntegrationDb(
                github_repo=github_repo,
                created_at=datetime.now(UTC),
            )
            session.add(new_integration)
            await session.commit()
            await session.refresh(new_integration)
            integration_id = new_integration.integration_id
            LOGGER.info(f"[SCRIBE] Created new integration {integration_id} for GitHub repo {github_repo}")

        install_url = create_slack_integration_url(integration_id, VARIABLES.SCRIBE_SLACK_CLIENT_ID)

        return JSONResponse(
            content={
                "integration_id": integration_id,
                "github_repo": github_repo,
                "install_url": install_url,
                "scopes": SLACK_SCOPES,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error generating Slack install link: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate install link")


@fai_app.get("/scribe/slack/oauth/callback", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_scribe_slack_oauth_callback(code: str, state: str | None = None) -> JSONResponse:
    return await handle_oauth_callback(
        code=code,
        state=state,
        integration_db_model=ScribeIntegrationDb,
        client_id=VARIABLES.SCRIBE_SLACK_CLIENT_ID,
        client_secret=VARIABLES.SCRIBE_SLACK_CLIENT_SECRET,
        log_prefix="[SCRIBE]",
    )


@fai_app.post("/scribe/slack/slash-commands", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_scribe_slash_commands(request: Request) -> JSONResponse:
    try:
        form_data = await request.form()
        command_data = dict(form_data)

        command = command_data.get("command")
        text = command_data.get("text", "")
        user_id = command_data.get("user_id")
        channel_id = command_data.get("channel_id")
        team_id = command_data.get("team_id")

        LOGGER.info(f"[SCRIBE] Received Slack slash command: {command} from user {user_id}")

        if isinstance(command, str) and command == "/scribe":
            if not team_id or not channel_id or not user_id:
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": "Missing required information. Please try again.",
                    }
                )
            return await handle_scribe_configure_command(text, team_id, channel_id, user_id, command)

        response_text = f"Received command: {command}"
        if text:
            response_text += f" with arguments: {text}"

        return JSONResponse(
            content={
                "response_type": "in_channel",
                "text": response_text,
            }
        )

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error handling Slack slash command: {e}")
        return JSONResponse(
            content={"text": "Sorry, an error occurred processing your command."},
            status_code=200,
        )


async def handle_scribe_configure_command(
    text: str, team_id: str, channel_id: str, user_id: str, command: str
) -> JSONResponse:
    try:
        parts = text.split()

        cmd_name = command

        if len(parts) < 1:
            return JSONResponse(
                content={
                    "response_type": "ephemeral",
                    "text": (
                        "*Usage:*\n"
                        f"• `{cmd_name} show` - Show current settings\n"
                        f"• `{cmd_name} repo owner/repo` - Set GitHub repo override for this channel\n"
                        f"• `{cmd_name} help` - Show this help message"
                    ),
                }
            )

        action = parts[0]

        if action == "help":
            return JSONResponse(
                content={
                    "response_type": "ephemeral",
                    "text": (
                        "*Scribe Channel Configuration*\n\n"
                        "*Commands:*\n"
                        f"• `{cmd_name} show` - Display current channel settings\n"
                        f"• `{cmd_name} repo owner/repo` - Set GitHub repository override for this channel\n"
                        f"• `{cmd_name} repo clear` - Clear repository override (use default)\n\n"
                        "*Examples:*\n"
                        f"• `{cmd_name} repo fern-api/fern-platform`\n"
                        f"• `{cmd_name} repo clear`"
                    ),
                }
            )

        async with async_session_maker() as session:
            result = await session.execute(
                select(ScribeIntegrationDb).where(ScribeIntegrationDb.slack_team_id == team_id)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": "Slack integration not found. Please install the Scribe bot first.",
                    }
                )

            current_settings = integration.settings or {}
            if not isinstance(current_settings, dict):
                current_settings = {}

            channel_settings = current_settings.get(channel_id, {})

            if "repo_override" not in channel_settings:
                channel_settings["repo_override"] = None

            if action == "show":
                settings_obj = ScribeChannelSettings(**channel_settings)
                repo_text = (
                    settings_obj.repo_override if settings_obj.repo_override else f"{integration.github_repo} (default)"
                )

                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": (f"*Current settings for <#{channel_id}>:*\n" f"• *GitHub repository:* {repo_text}"),
                    }
                )

            elif action == "repo":
                if len(parts) < 2:
                    return JSONResponse(
                        content={
                            "response_type": "ephemeral",
                            "text": (
                                "Please provide a repository. "
                                f"Example: `{cmd_name} repo owner/repo` or `{cmd_name} repo clear`"
                            ),
                        }
                    )

                repo = " ".join(parts[1:])
                if repo.lower() == "clear" or repo.lower() == "none":
                    channel_settings["repo_override"] = None
                    repo_text = f"cleared (using default: {integration.github_repo})"
                else:
                    validation_result = await validate_scribe_github_repo_access(repo)

                    if not validation_result["ok"]:
                        error = validation_result["error"]
                        LOGGER.warning(
                            f"[SCRIBE] Validation failed for repo {repo}: " f"{error['type']} - {error['message']}"
                        )
                        return JSONResponse(
                            content={
                                "response_type": "ephemeral",
                                "text": f"Failed to validate repository: {error['message']}",
                            }
                        )

                    channel_settings["repo_override"] = repo
                    repo_text = f"`{repo}`"

                if current_settings is None:
                    current_settings = {}
                current_settings[channel_id] = channel_settings

                integration.settings = current_settings
                attributes.flag_modified(integration, "settings")

                LOGGER.info(f"[SCRIBE] Updating repo override for {channel_id}: {repo}")

                await session.commit()
                await session.refresh(integration)

                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": f"Updated repository override for <#{channel_id}>: {repo_text}",
                    }
                )

            else:
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": f"Unknown action '{action}'. Use `{cmd_name} help` for available commands.",
                    }
                )

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error handling configure command: {e}")
        return JSONResponse(
            content={
                "response_type": "ephemeral",
                "text": "An error occurred while updating settings. Please try again.",
            }
        )
