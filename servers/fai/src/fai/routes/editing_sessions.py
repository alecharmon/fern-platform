import uuid
from datetime import (
    UTC,
    datetime,
)

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import get_db
from fai.models.api.editing_session_api import (
    CreateEditingSessionRequest,
    CreateEditingSessionResponse,
    GetEditingSessionResponse,
    InterruptEditingSessionResponse,
    UpdateEditingSessionRequest,
    UpdateEditingSessionResponse,
)
from fai.models.db.editing_session_db import EditingSessionDb
from fai.models.types.editing_session_types import EditingSessionStatus
from fai.settings import LOGGER
from fai.utils.sqs_utils import (
    InterruptMessage,
    create_session_queue,
    delete_session_queue,
    send_message_to_queue,
)


def _generate_working_branch(repository: str) -> str:
    """Generate a unique working branch name for an editing session."""
    repo_name = repository.split("/")[-1] if "/" in repository else repository
    timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    short_id = str(uuid.uuid4())[:8]
    return f"fern-scribe/{repo_name}/{timestamp}-{short_id}"


@fai_app.post(
    "/editing-sessions",
    response_model=CreateEditingSessionResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def create_editing_session(
    request: CreateEditingSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Create a new editing session."""
    LOGGER.info(f"Creating new editing session for repository: {request.repository}")
    try:
        editing_id = str(uuid.uuid4())
        working_branch = _generate_working_branch(request.repository)

        queue_url = await create_session_queue(editing_id)
        if queue_url is None:
            LOGGER.error(f"Failed to create SQS queue for session {editing_id}")
            return JSONResponse(
                content={"error": "Failed to create SQS queue for editing session"},
                status_code=500,
            )

        db_session = EditingSessionDb(
            id=editing_id,
            session_id=None,
            repository=request.repository,
            base_branch=request.base_branch,
            working_branch=working_branch,
            pr_url=None,
            queue_url=queue_url,
            status=EditingSessionStatus.STARTUP,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        db.add(db_session)
        await db.commit()
        await db.refresh(db_session)

        LOGGER.info(f"Created editing session: {editing_id} with branch: {working_branch} and queue: {queue_url}")

        return JSONResponse(
            content=jsonable_encoder(CreateEditingSessionResponse(editing_session=db_session.to_api())),
            status_code=201,
        )

    except Exception as e:
        LOGGER.exception(f"Failed to create editing session: {e}")
        return JSONResponse(
            content={"error": "Failed to create editing session", "details": str(e)},
            status_code=500,
        )


@fai_app.get(
    "/editing-sessions/{editing_id}",
    response_model=GetEditingSessionResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_editing_session(
    editing_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Retrieve an editing session by ID."""
    LOGGER.info(f"Retrieving editing session: {editing_id}")
    try:
        result = await db.execute(select(EditingSessionDb).where(EditingSessionDb.id == editing_id))
        db_session = result.scalar_one_or_none()

        if db_session is None:
            LOGGER.warning(f"Editing session not found: {editing_id}")
            return JSONResponse(
                content={"error": "Editing session not found"},
                status_code=404,
            )

        return JSONResponse(content=jsonable_encoder(GetEditingSessionResponse(editing_session=db_session.to_api())))

    except Exception as e:
        LOGGER.exception(f"Failed to retrieve editing session: {e}")
        return JSONResponse(
            content={"error": "Failed to retrieve editing session", "details": str(e)},
            status_code=500,
        )


@fai_app.put(
    "/editing-sessions/{editing_id}",
    response_model=UpdateEditingSessionResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def update_editing_session(
    editing_id: str,
    request: UpdateEditingSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Update an editing session with session_id and/or pr_url."""
    LOGGER.info(f"Updating editing session: {editing_id}")
    try:
        result = await db.execute(select(EditingSessionDb).where(EditingSessionDb.id == editing_id))
        db_session = result.scalar_one_or_none()

        if db_session is None:
            LOGGER.warning(f"Editing session not found: {editing_id}")
            return JSONResponse(
                content={"error": "Editing session not found"},
                status_code=404,
            )

        if request.session_id is not None:
            db_session.session_id = request.session_id
        if request.pr_url is not None:
            db_session.pr_url = request.pr_url
        if request.status is not None:
            db_session.status = request.status

        db_session.updated_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(db_session)

        LOGGER.info(f"Updated editing session: {editing_id}")

        return JSONResponse(content=jsonable_encoder(UpdateEditingSessionResponse(editing_session=db_session.to_api())))

    except Exception as e:
        LOGGER.exception(f"Failed to update editing session: {e}")
        return JSONResponse(
            content={"error": "Failed to update editing session", "details": str(e)},
            status_code=500,
        )


@fai_app.post(
    "/editing-sessions/{editing_id}/interrupt",
    response_model=InterruptEditingSessionResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def interrupt_editing_session(
    editing_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Interrupt a running editing session by sending INTERRUPT message to SQS."""
    LOGGER.info(f"Interrupting editing session: {editing_id}")
    try:
        result = await db.execute(select(EditingSessionDb).where(EditingSessionDb.id == editing_id))
        db_session = result.scalar_one_or_none()

        if db_session is None:
            LOGGER.warning(f"Editing session not found: {editing_id}")
            return JSONResponse(
                content={"error": "Editing session not found"},
                status_code=404,
            )

        if db_session.status in [EditingSessionStatus.INTERRUPTED, EditingSessionStatus.COMPLETED]:
            LOGGER.warning(f"Cannot interrupt session with status {db_session.status}: {editing_id}")
            return JSONResponse(
                content={"error": f"Cannot interrupt session with status: {db_session.status}"},
                status_code=400,
            )

        if not db_session.queue_url:
            LOGGER.error(f"No queue URL for session {editing_id}, cannot send interrupt message")
            return JSONResponse(
                content={"error": "No queue URL found for session"},
                status_code=500,
            )

        interrupt_msg = InterruptMessage(
            editing_id=editing_id,
            timestamp=datetime.now(UTC).isoformat(),
        )

        success = await send_message_to_queue(db_session.queue_url, interrupt_msg)
        if not success:
            LOGGER.error(f"Failed to send interrupt message to queue for session {editing_id}")
            return JSONResponse(
                content={"error": "Failed to send interrupt message to queue"},
                status_code=500,
            )

        db_session.status = EditingSessionStatus.INTERRUPTED
        db_session.updated_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(db_session)

        LOGGER.info(f"Sent interrupt message and updated status for session: {editing_id}")

        return JSONResponse(
            content=jsonable_encoder(InterruptEditingSessionResponse(editing_session=db_session.to_api())),
            status_code=200,
        )

    except Exception as e:
        LOGGER.exception(f"Failed to interrupt editing session: {e}")
        return JSONResponse(
            content={"error": "Failed to interrupt editing session", "details": str(e)},
            status_code=500,
        )


@fai_app.delete(
    "/editing-sessions/{editing_id}/queue",
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def cleanup_session_queue(
    editing_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Delete the SQS queue for an editing session."""
    LOGGER.info(f"Cleaning up queue for editing session: {editing_id}")
    try:
        result = await db.execute(select(EditingSessionDb).where(EditingSessionDb.id == editing_id))
        db_session = result.scalar_one_or_none()

        if db_session is None:
            LOGGER.warning(f"Editing session not found: {editing_id}")
            return JSONResponse(
                content={"error": "Editing session not found"},
                status_code=404,
            )

        if not db_session.queue_url:
            LOGGER.info(f"No queue URL for session {editing_id}, nothing to clean up")
            return JSONResponse(
                content={"message": "No queue to clean up"},
                status_code=200,
            )

        success = await delete_session_queue(db_session.queue_url)
        if success:
            db_session.queue_url = None
            db_session.updated_at = datetime.now(UTC)
            await db.commit()

            LOGGER.info(f"Successfully cleaned up queue for session {editing_id}")
            return JSONResponse(
                content={"message": "Queue cleaned up successfully"},
                status_code=200,
            )
        else:
            LOGGER.warning(f"Failed to delete queue for session {editing_id}")
            return JSONResponse(
                content={"error": "Failed to delete queue"},
                status_code=500,
            )

    except Exception as e:
        LOGGER.exception(f"Error cleaning up queue for session {editing_id}: {e}")
        return JSONResponse(
            content={"error": "Failed to clean up queue", "details": str(e)},
            status_code=500,
        )
