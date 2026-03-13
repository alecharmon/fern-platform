import asyncio
import datetime
from collections.abc import Awaitable, Callable, Mapping
from typing import Protocol

import httpx
import jwt
from cachetools import LRUCache, TTLCache  # type: ignore[import-untyped]

from .types import CreditCheckResult


class LoggerLike(Protocol):
    def warning(self, msg: str) -> None: ...

    def exception(self, msg: str) -> None: ...


class OrgAiCreditClient:
    def __init__(
        self,
        dashboard_url: str,
        jwt_secret: str,
        resolve_org_id: Callable[[str], Awaitable[str]],
        logger: LoggerLike,
        service_name: str = "fai",
    ):
        self._domain_cache: LRUCache[str, str] = LRUCache(maxsize=1000)
        self._credit_cache: TTLCache[str, CreditCheckResult] = TTLCache(maxsize=1000, ttl=30)
        self._http = httpx.AsyncClient(timeout=5.0)
        self._jwt_secret = jwt_secret
        self._dashboard_url = dashboard_url
        self._resolve_org_id_for_domain = resolve_org_id
        self._logger = logger
        self._service_name = service_name

    async def _resolve_org_id(self, domain: str, org_id: str | None = None) -> str:
        if org_id is not None:
            self._domain_cache[domain] = org_id
            return org_id

        cached = self._domain_cache.get(domain)
        if cached is not None:
            return cached

        resolved = await self._resolve_org_id_for_domain(domain)
        self._domain_cache[domain] = resolved
        return resolved

    async def _request_with_retry(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        max_retries = 3
        base_delay = 0.1

        for attempt in range(max_retries):
            try:
                response = await self._http.request(method, url, **kwargs)
                response.raise_for_status()
                return response
            except httpx.HTTPError as exc:
                if attempt == max_retries - 1:
                    raise
                wait_time = base_delay * (2**attempt)
                self._logger.warning(
                    f"OrgAiCreditClient Attempt {attempt + 1}/{max_retries} failed: {exc}. Retrying in {wait_time}s"
                )
                await asyncio.sleep(wait_time)

        raise RuntimeError("Unreachable code")

    async def check_credits(self, domain: str, org_id: str | None = None) -> CreditCheckResult:
        try:
            resolved_org_id = await self._resolve_org_id(domain, org_id=org_id)
        except Exception:
            self._logger.exception("Failed to resolve org_id for credit check")
            return CreditCheckResult(allowed=True, used=0, limit=0)

        cached = self._credit_cache.get(resolved_org_id)
        if cached is not None:
            return cached

        try:
            response = await self._request_with_retry(
                "GET",
                f"{self._dashboard_url}/api/services/activity-log/credits-check",
                params={"org_id": resolved_org_id},
                headers={"Authorization": f"Bearer {self._sign_jwt()}"},
            )
            result = CreditCheckResult(**response.json())
            self._credit_cache[resolved_org_id] = result
            return result
        except Exception:
            self._logger.exception("Credit check failed, failing open")
            return CreditCheckResult(allowed=True, used=0, limit=0)

    async def log_usage(self, domain: str, entry: Mapping[str, object], org_id: str | None = None) -> None:
        try:
            resolved_org_id = await self._resolve_org_id(domain, org_id=org_id)
        except Exception:
            self._logger.exception("Failed to resolve org_id for usage logging")
            return

        try:
            await self._request_with_retry(
                "POST",
                f"{self._dashboard_url}/api/services/activity-log/activity-with-credits",
                json={**entry, "org_id": resolved_org_id},
                headers={"Authorization": f"Bearer {self._sign_jwt()}"},
            )
        except Exception:
            self._logger.exception("Failed to log usage")

    def _sign_jwt(self) -> str:
        now = datetime.datetime.now(tz=datetime.UTC)
        payload = {
            "service": self._service_name,
            "aud": "dashboard-activity-log",
            "iss": "https://buildwithfern.com",
            "exp": now + datetime.timedelta(hours=1),
            "iat": now,
        }
        return jwt.encode(payload, self._jwt_secret, algorithm="HS256")
