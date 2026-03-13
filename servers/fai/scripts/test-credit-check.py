#!/usr/bin/env python3
"""
Test the OrgAiCreditClient against a real dashboard API.

Usage:
    # Check credits for an org (by org_id)
    python servers/fai/scripts/test-credit-check.py --org-id <org_id>

    # Check credits for an org (by domain, resolves org_id via FDR)
    python servers/fai/scripts/test-credit-check.py --domain <domain>

    # Use prod instead of dev
    python servers/fai/scripts/test-credit-check.py --org-id <org_id> --env prod

    # Override JWT secret
    python servers/fai/scripts/test-credit-check.py --org-id <org_id> --jwt-secret <secret>

    # Override dashboard URL directly
    python servers/fai/scripts/test-credit-check.py --org-id <org_id> --dashboard-url https://...

Environment variables (optional, used as defaults):
    JWT_SECRET_KEY       - JWT signing secret
    DASHBOARD_API_URL    - Dashboard base URL
    FERN_TOKEN           - Used for FDR domain->org resolution
"""

import argparse
import asyncio
import datetime
import json
import sys

try:
    import httpx
    import jwt
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install httpx PyJWT")
    sys.exit(1)

ENVS = {
    "dev": "https://dashboard-dev.buildwithfern.com",
    "prod": "https://dashboard.buildwithfern.com",
}

FDR_URLS = {
    "dev": "https://registry-v2-dev2.buildwithfern.com/v2/registry/docs/metadata-for-url",
    "prod": "https://registry.buildwithfern.com/v2/registry/docs/metadata-for-url",
}


def sign_jwt(secret: str, service: str = "fai") -> str:
    now = datetime.datetime.now(tz=datetime.UTC)
    payload = {
        "service": service,
        "aud": "dashboard-activity-log",
        "iss": "https://buildwithfern.com",
        "exp": now + datetime.timedelta(hours=1),
        "iat": now,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


async def resolve_org_id(domain: str, fern_token: str | None = None, env: str = "prod") -> str:
    fdr_url = FDR_URLS[env]
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if fern_token:
        headers["Authorization"] = f"Bearer {fern_token}"

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.post(fdr_url, headers=headers, json={"url": domain}, timeout=10.0)
        response.raise_for_status()
        metadata = response.json()
        org = metadata.get("org", "")
        print(f"Resolved domain={domain} -> org={org}")
        print(f"  Full metadata: {json.dumps(metadata, indent=2)}")
        return org


async def check_credits(dashboard_url: str, jwt_secret: str, org_id: str) -> None:
    token = sign_jwt(jwt_secret)
    url = f"{dashboard_url}/api/services/activity-log/credits-check"

    print(f"\n--- Credit Check ---")
    print(f"Dashboard: {dashboard_url}")
    print(f"Org ID:    {org_id}")
    print(f"Endpoint:  GET {url}?org_id={org_id}")

    decoded = jwt.decode(token, options={"verify_signature": False})
    print(f"JWT claims: {json.dumps(decoded, indent=2, default=str)}")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            url,
            params={"org_id": org_id},
            headers={"Authorization": f"Bearer {token}"},
        )

    print(f"\nHTTP {response.status_code}")
    print(f"Response headers: {dict(response.headers)}")

    try:
        body = response.json()
        print(f"Response body: {json.dumps(body, indent=2)}")

        if response.status_code == 200:
            print(f"\n--- Result ---")
            print(f"  Allowed: {body.get('allowed')}")
            print(f"  Used:    {body.get('used')}")
            print(f"  Limit:   {body.get('limit')}")
        else:
            print(f"\n--- Error ---")
            print(f"  Status: {response.status_code}")
    except Exception:
        print(f"Response text: {response.text}")


async def test_log_usage(dashboard_url: str, jwt_secret: str, org_id: str, domain: str) -> None:
    token = sign_jwt(jwt_secret)
    url = f"{dashboard_url}/api/services/activity-log/activity-with-credits"

    body = {
        "org_id": org_id,
        "site": domain,
        "entry": {
            "type": "ask_fern",
            "metadata": {
                "question": "test-credit-check.py smoke test",
                "response_tokens": 0,
            },
        },
    }

    print(f"\n--- Log Usage (dry-run payload) ---")
    print(f"Endpoint:  POST {url}")
    print(f"Body: {json.dumps(body, indent=2)}")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {token}"},
        )

    print(f"\nHTTP {response.status_code}")
    try:
        resp_body = response.json()
        print(f"Response body: {json.dumps(resp_body, indent=2)}")
    except Exception:
        print(f"Response text: {response.text}")


def main() -> None:
    import os

    parser = argparse.ArgumentParser(description="Test OrgAiCreditClient against dashboard API")
    parser.add_argument("--org-id", help="Org ID to check credits for")
    parser.add_argument("--domain", help="Domain to resolve org ID from (e.g. vellum.docs.buildwithfern.com)")
    parser.add_argument("--env", choices=["dev", "prod"], default="dev", help="Environment (default: dev)")
    parser.add_argument("--dashboard-url", help="Override dashboard URL")
    parser.add_argument("--jwt-secret", help="JWT secret (default: JWT_SECRET_KEY env var)")
    parser.add_argument("--fern-token", help="Fern token for domain resolution (default: FERN_TOKEN env var)")
    parser.add_argument("--test-log", action="store_true", help="Also test the log_usage endpoint")
    args = parser.parse_args()

    if not args.org_id and not args.domain:
        parser.error("Must provide either --org-id or --domain")

    jwt_secret = args.jwt_secret or os.environ.get("JWT_SECRET_KEY")
    if not jwt_secret:
        parser.error("Must provide --jwt-secret or set JWT_SECRET_KEY env var")

    dashboard_url = args.dashboard_url or os.environ.get("DASHBOARD_API_URL") or ENVS[args.env]
    fern_token = args.fern_token or os.environ.get("FERN_TOKEN")

    async def run() -> None:
        org_id = args.org_id
        domain = args.domain or "unknown"
        if not org_id:
            org_id = await resolve_org_id(args.domain, fern_token, env=args.env)
            if not org_id:
                print("ERROR: Could not resolve org_id from domain")
                sys.exit(1)

        await check_credits(dashboard_url, jwt_secret, org_id)

        if args.test_log:
            await test_log_usage(dashboard_url, jwt_secret, org_id, domain)

    asyncio.run(run())


if __name__ == "__main__":
    main()
