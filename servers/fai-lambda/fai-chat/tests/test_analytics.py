from unittest.mock import (
    MagicMock,
    patch,
)

from src.analytics.constants import ErrorType
from src.analytics.events import (
    track_chat_request_error,
    track_chat_request_success,
    track_llm_provider_fallback,
    track_retrieval_error,
)
from src.analytics.posthog_client import get_posthog_client
from src.models.metrics import RequestMetrics


class TestPostHogClient:
    @patch("src.analytics.posthog_client.os.getenv")
    def test_client_initializes_with_api_key(self, mock_getenv: MagicMock) -> None:
        mock_getenv.return_value = "test-api-key"
        get_posthog_client.cache_clear()

        with patch("src.analytics.posthog_client.Posthog") as mock_posthog:
            client = get_posthog_client()

            mock_posthog.assert_called_once_with(
                api_key="test-api-key",
                flush_at=1,
                flush_interval=0,
            )
            assert client is not None

    @patch("src.analytics.posthog_client.os.getenv")
    def test_client_returns_none_without_api_key(self, mock_getenv: MagicMock) -> None:
        mock_getenv.return_value = None
        get_posthog_client.cache_clear()

        client = get_posthog_client()

        assert client is None

    @patch("src.analytics.posthog_client.os.getenv")
    def test_client_strips_whitespace_from_api_key(self, mock_getenv: MagicMock) -> None:
        mock_getenv.return_value = "  test-api-key  "
        get_posthog_client.cache_clear()

        with patch("src.analytics.posthog_client.Posthog") as mock_posthog:
            get_posthog_client()

            mock_posthog.assert_called_once_with(
                api_key="test-api-key",
                flush_at=1,
                flush_interval=0,
            )


class TestTrackingEvents:
    @patch("src.analytics.events.get_posthog_client")
    def test_track_chat_request_success(self, mock_get_client: MagicMock) -> None:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        metrics = RequestMetrics(
            request_received_ms=1000.0,
            retrieval_start_ms=1050.0,
            retrieval_end_ms=1100.0,
            llm_start_ms=1150.0,
            first_token_ms=1200.0,
            llm_end_ms=1500.0,
            input_tokens=100,
            output_tokens=50,
        )

        track_chat_request_success(
            domain="test.buildwithfern.com",
            metrics=metrics,
            llm_provider="anthropic",
            message_count=3,
        )

        mock_client.capture.assert_called_once()
        call_args = mock_client.capture.call_args
        assert call_args[1]["distinct_id"] == "server-side-event"
        assert call_args[1]["event"] == "chat_request_success"
        assert call_args[1]["properties"]["domain"] == "test.buildwithfern.com"
        assert call_args[1]["properties"]["llm_provider"] == "anthropic"
        assert call_args[1]["properties"]["message_count"] == 3
        assert call_args[1]["properties"]["$process_person_profile"] is False

    @patch("src.analytics.events.get_posthog_client")
    def test_track_chat_request_error(self, mock_get_client: MagicMock) -> None:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        track_chat_request_error(
            domain="test.buildwithfern.com",
            error_type=ErrorType.RETRIEVAL_FAILED,
            status_code=500,
            error_message="Failed to retrieve documents",
        )

        mock_client.capture.assert_called_once()
        call_args = mock_client.capture.call_args
        assert call_args[1]["distinct_id"] == "server-side-event"
        assert call_args[1]["event"] == "chat_request_error"
        assert call_args[1]["properties"]["domain"] == "test.buildwithfern.com"
        assert call_args[1]["properties"]["error_type"] == ErrorType.RETRIEVAL_FAILED
        assert call_args[1]["properties"]["status_code"] == 500
        assert call_args[1]["properties"]["error_message"] == "Failed to retrieve documents"

    @patch("src.analytics.events.get_posthog_client")
    def test_track_llm_provider_fallback(self, mock_get_client: MagicMock) -> None:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        track_llm_provider_fallback(
            failed_provider="bedrock",
            fallback_provider="anthropic",
            error_reason="Rate limit exceeded",
        )

        mock_client.capture.assert_called_once()
        call_args = mock_client.capture.call_args
        assert call_args[1]["distinct_id"] == "server-side-event"
        assert call_args[1]["event"] == "llm_provider_fallback"
        assert call_args[1]["properties"]["failed_provider"] == "bedrock"
        assert call_args[1]["properties"]["fallback_provider"] == "anthropic"
        assert call_args[1]["properties"]["error_reason"] == "Rate limit exceeded"

    @patch("src.analytics.events.get_posthog_client")
    def test_track_retrieval_error(self, mock_get_client: MagicMock) -> None:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        track_retrieval_error(
            domain="test.buildwithfern.com",
            error_type="vector_store_error",
            error_message="Connection timeout",
        )

        mock_client.capture.assert_called_once()
        call_args = mock_client.capture.call_args
        assert call_args[1]["distinct_id"] == "server-side-event"
        assert call_args[1]["event"] == "retrieval_error"
        assert call_args[1]["properties"]["domain"] == "test.buildwithfern.com"
        assert call_args[1]["properties"]["error_type"] == "vector_store_error"

    @patch("src.analytics.events.get_posthog_client")
    def test_tracking_does_not_raise_when_client_is_none(self, mock_get_client: MagicMock) -> None:
        mock_get_client.return_value = None

        track_chat_request_error(
            domain="test.buildwithfern.com",
            error_type=ErrorType.ASK_AI_NOT_ENABLED,
            status_code=404,
        )

    @patch("src.analytics.events.get_posthog_client")
    def test_tracking_does_not_raise_on_exception(self, mock_get_client: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.capture.side_effect = Exception("PostHog API error")
        mock_get_client.return_value = mock_client

        track_chat_request_success(
            domain="test.buildwithfern.com",
            metrics=RequestMetrics(
                request_received_ms=1000.0,
                retrieval_start_ms=1050.0,
                retrieval_end_ms=1100.0,
                llm_start_ms=1150.0,
                first_token_ms=1200.0,
                llm_end_ms=1500.0,
                input_tokens=100,
                output_tokens=50,
            ),
            llm_provider="anthropic",
            message_count=3,
        )
