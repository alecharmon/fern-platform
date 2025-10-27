from pydantic import BaseModel

from fai.models.types.editing_session_types import EditingSession


class CreateEditingSessionRequest(BaseModel):
    """Request to create a new editing session."""

    repository: str
    base_branch: str


class CreateEditingSessionResponse(BaseModel):
    """Response when creating a new editing session."""

    editing_session: EditingSession


class GetEditingSessionResponse(BaseModel):
    """Response when retrieving an editing session."""

    editing_session: EditingSession


class UpdateEditingSessionRequest(BaseModel):
    """Request to update an editing session."""

    session_id: str | None = None
    pr_url: str | None = None


class UpdateEditingSessionResponse(BaseModel):
    """Response when updating an editing session."""

    editing_session: EditingSession
