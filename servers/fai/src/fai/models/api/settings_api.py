from pydantic import (
    BaseModel,
    Field,
)

from fai.models.types.settings_types import Settings


class UpdateSettingsResponse(BaseModel):
    success: bool = Field(description="Whether the operation was successful")
    settings: Settings | None = Field(description="Ask AI configuration settings")


class GetSettingsResponse(BaseModel):
    ask_ai_enabled: bool = Field(description="Whether Ask AI is enabled")
    job_id: str | None = Field(None, description="Active job ID if reindexing is in progress")


class ToggleAskAiResponse(BaseModel):
    success: bool = Field(description="Whether the toggle operation was successful")
    job_id: str | None = Field(None, description="Job ID for tracking reindex progress (only when enabling Ask AI)")
    ask_ai_enabled: bool = Field(description="Current state of Ask AI (true if enabled, false if disabled)")


class ToggleStatusResponse(BaseModel):
    status: str = Field(description="Current job status (running, completed, failed, etc.)")
    ask_ai_enabled: bool = Field(description="Current state of Ask AI")
    last_reindex_time: str | None = Field(None, description="ISO timestamp of last reindex")
