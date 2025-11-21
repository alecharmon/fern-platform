import functools
import logging
import os

import httpx

from .models import AuthState, AuthUser

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def get_httpx_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=5.0)


async def fetch_auth_state(domain: str, fern_token: str | None) -> AuthState:
    if not fern_token:
        return AuthState(authenticated=False)

    verify_base_url = os.getenv("FERN_DOCS_VERIFY_BASE_URL", "https://prod.ferndocs.com")
    client = get_httpx_client()

    try:
        response = await client.post(
            f"{verify_base_url}/api/fern-docs/auth/verify",
            headers={"FERN_TOKEN": fern_token, "x-fern-host": domain, "Content-Type": "application/json"},
        )

        if response.status_code != 200:
            logger.warning(f"Auth verification returned status {response.status_code} for domain {domain}")
            return AuthState(authenticated=False)

        data = response.json()

        if not data.get("authenticated", False):
            return AuthState(authenticated=False)

        user_data = data.get("user", {})
        user = AuthUser(
            name=user_data.get("name"),
            email=user_data.get("email"),
            roles=user_data.get("roles", []),
        )

        return AuthState(authenticated=True, user=user)

    except httpx.TimeoutException:
        logger.warning(f"Auth verification timed out for domain {domain}")
        return AuthState(authenticated=False, error="Verification timeout")
    except Exception as e:
        logger.exception(f"Error fetching auth state for domain {domain}")
        return AuthState(authenticated=False, error=str(e))
