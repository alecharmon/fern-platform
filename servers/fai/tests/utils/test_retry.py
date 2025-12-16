from unittest.mock import (
    AsyncMock,
    patch,
)

import httpx
import pytest


class TestRetryWithExponentialBackoff:
    @pytest.mark.asyncio
    async def test_succeeds_on_first_attempt(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(return_value="success")

        result = await retry_with_exponential_backoff(mock_func)

        assert result == "success"
        mock_func.assert_called_once()

    @pytest.mark.asyncio
    async def test_retries_on_http_error(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=[httpx.HTTPError("error"), httpx.HTTPError("error"), "success"])

        result = await retry_with_exponential_backoff(mock_func, max_retries=3)

        assert result == "success"
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_fails_after_max_retries(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=httpx.HTTPError("persistent error"))

        with pytest.raises(httpx.HTTPError, match="persistent error"):
            await retry_with_exponential_backoff(mock_func, max_retries=3)

        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_exponential_backoff_timing(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=[httpx.HTTPError("error"), httpx.HTTPError("error"), "success"])
        delays = []

        async def mock_sleep(duration: float) -> None:
            delays.append(duration)

        with patch("fai.utils.retry.asyncio.sleep", side_effect=mock_sleep):
            await retry_with_exponential_backoff(mock_func, max_retries=3, base_delay=1.0)

        assert len(delays) == 2
        assert delays[0] == 1.0
        assert delays[1] == 2.0

    @pytest.mark.asyncio
    async def test_custom_base_delay(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=[httpx.HTTPError("error"), "success"])
        delays = []

        async def mock_sleep(duration: float) -> None:
            delays.append(duration)

        with patch("fai.utils.retry.asyncio.sleep", side_effect=mock_sleep):
            await retry_with_exponential_backoff(mock_func, max_retries=3, base_delay=2.0)

        assert len(delays) == 1
        assert delays[0] == 2.0

    @pytest.mark.asyncio
    async def test_custom_retry_on_exceptions(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=[ValueError("error"), "success"])

        result = await retry_with_exponential_backoff(mock_func, max_retries=3, retry_on=(ValueError,))

        assert result == "success"
        assert mock_func.call_count == 2

    @pytest.mark.asyncio
    async def test_does_not_retry_on_different_exception(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=ValueError("error"))

        with pytest.raises(ValueError, match="error"):
            await retry_with_exponential_backoff(mock_func, max_retries=3, retry_on=(httpx.HTTPError,))

        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_logs_retry_attempts(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=[httpx.HTTPError("error"), "success"])

        with (
            patch("fai.utils.retry.asyncio.sleep", new_callable=AsyncMock),
            patch("fai.utils.retry.LOGGER") as mock_logger,
        ):
            await retry_with_exponential_backoff(mock_func, max_retries=3, log_prefix="[TEST]")

            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args[0][0]
            assert "[TEST]" in call_args
            assert "Attempt 1/3" in call_args
            assert "Retrying in" in call_args

    @pytest.mark.asyncio
    async def test_handles_multiple_exception_types(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=[httpx.HTTPError("http error"), ValueError("value error"), "success"])

        result = await retry_with_exponential_backoff(mock_func, max_retries=3, retry_on=(httpx.HTTPError, ValueError))

        assert result == "success"
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_retry_count_one_means_no_retry(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=httpx.HTTPError("error"))

        with pytest.raises(httpx.HTTPError):
            await retry_with_exponential_backoff(mock_func, max_retries=1)

        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_preserves_function_return_type(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        async def returns_dict() -> dict[str, int]:
            return {"key": 123}

        result = await retry_with_exponential_backoff(returns_dict)

        assert isinstance(result, dict)
        assert result == {"key": 123}

    @pytest.mark.asyncio
    async def test_works_with_zero_delay(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(side_effect=[httpx.HTTPError("error"), "success"])
        delays = []

        async def mock_sleep(duration: float) -> None:
            delays.append(duration)

        with patch("fai.utils.retry.asyncio.sleep", side_effect=mock_sleep):
            result = await retry_with_exponential_backoff(mock_func, max_retries=2, base_delay=0.0)

        assert result == "success"
        assert delays == [0.0]

    @pytest.mark.asyncio
    async def test_correct_exponential_progression(self) -> None:
        from fai.utils.retry import retry_with_exponential_backoff

        mock_func = AsyncMock(
            side_effect=[httpx.HTTPError("e1"), httpx.HTTPError("e2"), httpx.HTTPError("e3"), "success"]
        )
        delays = []

        async def mock_sleep(duration: float) -> None:
            delays.append(duration)

        with patch("fai.utils.retry.asyncio.sleep", side_effect=mock_sleep):
            await retry_with_exponential_backoff(mock_func, max_retries=4, base_delay=1.0)

        assert delays == [1.0, 2.0, 4.0]
