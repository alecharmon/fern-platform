from pydantic import (
    BaseModel,
    Field,
)

from fai.models.types.settings_types import Settings


class UpdateSettingsResponse(BaseModel):
    success: bool = Field(description="Whether the operation was successful")
    settings: Settings | None = Field(description="Ask AI configuration settings")


class GetSettingsResponse(BaseModel):
    ask_ai_enabled: bool = Field(
        description=(
            "Whether Ask AI is enabled (requires one of docs, slack, or discord "
            "to be enabled as well as the content to be indexed)"
        )
    )
    job_id: str | None = Field(
        None,
        description="Deprecated: always None. Use /reindexing/jobs endpoints to track job status.",
        deprecated=True,
    )
    is_initially_indexing: bool = Field(
        False,
        description="Whether the domain is being indexed for the first time (no data available yet)",
    )
    docs_enabled: bool | None = Field(None, description="Whether Ask AI is enabled for docs")
    slack_enabled: bool | None = Field(None, description="Whether Ask AI is enabled for slack")
    discord_enabled: bool | None = Field(None, description="Whether Ask AI is enabled for discord")
    decompose_queries: bool | None = Field(None, description="Whether query decomposition is enabled")


class ToggleAskAiResponse(BaseModel):
    success: bool = Field(description="Whether the toggle operation was successful")
    job_id: str | None = Field(None, description="Job ID for tracking reindex progress (only when enabling Ask AI)")
    ask_ai_enabled: bool = Field(description="Current state of Ask AI (true if enabled, false if disabled)")


class ToggleStatusResponse(BaseModel):
    status: str = Field(description="Current job status (running, completed, failed, etc.)")
    ask_ai_enabled: bool = Field(description="Current state of Ask AI")
    last_reindex_time: str | None = Field(None, description="ISO timestamp of last reindex")


class EnableAskAiRequest(BaseModel):
    domains: list[str] = Field(description="List of domains to enable Ask AI for")
    org_name: str = Field(description="Organization name")
    locations: list[str] = Field(description="List of locations to enable (docs, slack, discord)")
    preview: bool = Field(default=False, description="Whether this is a preview domain")


class EnableAskAiResponse(BaseModel):
    success: bool = Field(description="Whether the enable operation was successful")


class SetJobIdResponse(BaseModel):
    success: bool = Field(description="Whether the job_id was set successfully")
    domain: str | None = Field(None, description="Domain for which job_id was set")
    job_id: str | None = Field(None, description="The job_id that was set")
