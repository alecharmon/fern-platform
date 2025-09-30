from datetime import (
    UTC,
    datetime,
)

from fastapi import (
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import (
    get_db,
    verify_token,
)
from src.fai.models.db.discord_integration_db import DiscordIntegrationDb
from src.fai.models.types.discord_integration_types import DiscordIntegrationResponse
from src.fai.routes.settings import strip_domain
from src.settings import (
    LOGGER,
    VARIABLES,
)


@fai_app.post("/discord/install", openapi_extra={"x-fern-audiences": ["internal"]})
async def create_discord_integration(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> DiscordIntegrationResponse:
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(DiscordIntegrationDb).where(DiscordIntegrationDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()
        if existing_record:
            return DiscordIntegrationResponse(
                integration_url=f"{VARIABLES.DISCORD_OAUTH_URL}&state={existing_record.integration_id}"
            )

        new_integration = DiscordIntegrationDb(domain=stripped_domain, created_at=datetime.now(UTC))
        db.add(new_integration)
        await db.commit()
        await db.refresh(new_integration)

        integration_url = f"{VARIABLES.DISCORD_OAUTH_URL}&state={new_integration.integration_id}"

        return DiscordIntegrationResponse(integration_url=integration_url)

    except Exception:
        LOGGER.exception("Failed to create Discord integration")
        raise HTTPException(status_code=500, detail="Failed to create integration")


@fai_app.get("/discord/install/callback", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_discord_install_callback(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    try:
        integration = await db.execute(
            select(DiscordIntegrationDb).where(DiscordIntegrationDb.integration_id == request.query_params.get("state"))
        )
        integration = integration.scalar_one_or_none()
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")
        integration.discord_guild_id = request.query_params.get("guild_id")
        await db.commit()
        await db.refresh(integration)
        return JSONResponse(content={"message": "Discord bot added successfully"})
    except Exception:
        LOGGER.exception("Failed to update Discord integration")
        raise HTTPException(status_code=500, detail="Failed to update integration")
