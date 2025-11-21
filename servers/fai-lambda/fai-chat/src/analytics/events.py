import logging

from src.analytics.constants import ErrorType
from src.analytics.posthog_client import get_posthog_client
from src.models.metrics import RequestMetrics

logger = logging.getLogger(__name__)

DISTINCT_ID = "server-side-event"

__all__ = [
    "track_chat_request_success",
    "track_chat_request_error",
    "track_llm_provider_fallback",
    "track_retrieval_error",
    "track_tool_usage",
    "ErrorType",
]


def track_chat_request_success(
    domain: str,
    metrics: RequestMetrics,
    llm_provider: str,
    message_count: int,
) -> None:
    try:
        client = get_posthog_client()
        if client is None:
            return

        properties = {
            "$process_person_profile": False,
            "domain": domain,
            "llm_provider": llm_provider,
            "message_count": message_count,
            **metrics.to_dict(),
        }

        client.capture(
            distinct_id=DISTINCT_ID,
            event="chat_request_success",
            properties=properties,
        )
    except Exception as e:
        logger.error(f"Failed to track chat_request_success: {e}")


def track_chat_request_error(
    domain: str,
    error_type: str,
    status_code: int,
    error_message: str | None = None,
) -> None:
    try:
        client = get_posthog_client()
        if client is None:
            return

        properties = {
            "$process_person_profile": False,
            "domain": domain,
            "error_type": error_type,
            "status_code": status_code,
            "endpoint": "/chat",
        }

        if error_message:
            properties["error_message"] = error_message

        client.capture(
            distinct_id=DISTINCT_ID,
            event="chat_request_error",
            properties=properties,
        )
    except Exception as e:
        logger.error(f"Failed to track chat_request_error: {e}")


def track_llm_provider_fallback(
    failed_provider: str,
    fallback_provider: str,
    error_reason: str | None = None,
) -> None:
    try:
        client = get_posthog_client()
        if client is None:
            return

        properties = {
            "$process_person_profile": False,
            "failed_provider": failed_provider,
            "fallback_provider": fallback_provider,
        }

        if error_reason:
            properties["error_reason"] = error_reason

        client.capture(
            distinct_id=DISTINCT_ID,
            event="llm_provider_fallback",
            properties=properties,
        )
    except Exception as e:
        logger.error(f"Failed to track llm_provider_fallback: {e}")


def track_retrieval_error(
    domain: str,
    error_type: str,
    error_message: str | None = None,
) -> None:
    try:
        client = get_posthog_client()
        if client is None:
            return

        properties = {
            "$process_person_profile": False,
            "domain": domain,
            "error_type": error_type,
        }

        if error_message:
            properties["error_message"] = error_message

        client.capture(
            distinct_id=DISTINCT_ID,
            event="retrieval_error",
            properties=properties,
        )
    except Exception as e:
        logger.error(f"Failed to track retrieval_error: {e}")


def track_tool_usage(
    domain: str,
    tool_name: str,
    success: bool,
    execution_time_ms: float | None = None,
    result_count: int | None = None,
    error_message: str | None = None,
) -> None:
    try:
        client = get_posthog_client()
        if client is None:
            return

        properties = {
            "$process_person_profile": False,
            "domain": domain,
            "tool_name": tool_name,
            "success": success,
        }

        if execution_time_ms is not None:
            properties["execution_time_ms"] = execution_time_ms

        if result_count is not None:
            properties["result_count"] = result_count

        if error_message:
            properties["error_message"] = error_message

        client.capture(
            distinct_id=DISTINCT_ID,
            event="tool_usage",
            properties=properties,
        )
    except Exception as e:
        logger.error(f"Failed to track tool_usage: {e}")
