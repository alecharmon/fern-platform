from typing import Literal

from pydantic import (
    BaseModel,
    Field,
)


class ChannelSettings(BaseModel):
    allowed_roles: list[str] = Field(
        default_factory=list, description="List of RBAC roles that are allowed to interact with the bot in this channel"
    )
    respond_to: Literal["all", "mentions_only"] = Field(
        "mentions_only", description="Whether to respond to all messages or only mentions"
    )
    domain_override: str | None = Field(
        None, description="Override domain for queries in this channel (hidden setting)"
    )


class UpdateChannelSettings(BaseModel):
    settings: ChannelSettings
