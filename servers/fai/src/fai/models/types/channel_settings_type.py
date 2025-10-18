from typing import Literal

from pydantic import (
    BaseModel,
    Field,
)


class DiscordChannelSettings(BaseModel):
    allowed_roles: list[str] = Field(
        default_factory=list, description="List of RBAC roles that are allowed to interact with the bot in this channel"
    )
    channel_response: Literal["mentions_only", "auto"] = Field(
        "mentions_only", description="Whether to respond only to mentions or use auto mode (AI classification)"
    )
    domain_override: str | None = Field(
        None, description="Override domain for queries in this channel (hidden setting)"
    )
    help_role_id: str | None = Field(None, description="Role ID that can be tagged for help")


class UpdateDiscordChannelSettings(BaseModel):
    settings: DiscordChannelSettings
