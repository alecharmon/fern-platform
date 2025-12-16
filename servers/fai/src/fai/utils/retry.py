import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx

from fai.settings import LOGGER

T = TypeVar("T")


async def retry_with_exponential_backoff(
    func: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    base_delay: float = 1.0,
    log_prefix: str = "",
    retry_on: tuple[type[Exception], ...] = (httpx.HTTPError,),
) -> T:
    for attempt in range(max_retries):
        try:
            return await func()
        except retry_on as e:
            if attempt == max_retries - 1:
                raise
            wait_time = base_delay * (2**attempt)
            LOGGER.warning(f"{log_prefix} Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait_time}s")
            await asyncio.sleep(wait_time)
    raise RuntimeError("Unreachable code")
