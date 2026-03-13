import httpx
import pytest

from src.utils.retry import retry_with_exponential_backoff


@pytest.mark.asyncio
async def test_succeeds_on_first_try():
    call_count = 0

    async def succeed():
        nonlocal call_count
        call_count += 1
        return "ok"

    result = await retry_with_exponential_backoff(succeed, base_delay=0.01)
    assert result == "ok"
    assert call_count == 1


@pytest.mark.asyncio
async def test_retries_on_failure():
    call_count = 0

    async def fail_then_succeed():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise httpx.HTTPError("fail")
        return "ok"

    result = await retry_with_exponential_backoff(fail_then_succeed, base_delay=0.01)
    assert result == "ok"
    assert call_count == 3


@pytest.mark.asyncio
async def test_raises_after_max_retries():
    async def always_fail():
        raise httpx.HTTPError("fail")

    with pytest.raises(httpx.HTTPError):
        await retry_with_exponential_backoff(always_fail, max_retries=3, base_delay=0.01)
