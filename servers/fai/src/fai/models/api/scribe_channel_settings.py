from pydantic import BaseModel, Field


class ScribeChannelSettings(BaseModel):
    repo_override: str | None = Field(
        None, description="Override GitHub repository for Scribe in this channel (format: owner/repo)"
    )


class UpdateScribeChannelSettings(BaseModel):
    settings: ScribeChannelSettings
