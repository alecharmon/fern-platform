import json
import logging
import uuid
from datetime import (
    UTC,
    datetime,
)

import aioboto3
from botocore.exceptions import ClientError
from fastapi import (
    Depends,
    HTTPException,
)
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    strip_domain,
    verify_token,
)
from fai.models.api.github_source_api import (
    IndexGithubRequest,
    IndexGithubResponse,
)
from fai.models.db.index_source_db import (
    IndexSourceDb,
    IndexSourceStatus,
    SourceType,
)

logger = logging.getLogger(__name__)

LAMBDA_FUNCTION_NAME = "fai-code-indexing-dev2"


@fai_app.post(
    "/sources/github/{domain}/index",
    response_model=IndexGithubResponse,
    dependencies=[Depends(verify_token)],
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def index_github_source_repos(
    domain: str,
    request: IndexGithubRequest,
    db: AsyncSession = Depends(get_db),
) -> IndexGithubResponse:
    """Start indexing a GitHub repository for a domain."""
    stripped_domain = strip_domain(domain)

    job_id = str(uuid.uuid4())

    now = datetime.now(UTC)
    for repo_url in request.repo_urls:
        index_source = IndexSourceDb(
            id=str(uuid.uuid4()),
            domain=stripped_domain,
            source_type=SourceType.GITHUB,
            source_identifier=repo_url,
            config={},
            job_id=job_id,
            status=IndexSourceStatus.INDEXING,
            metrics={},
            created_at=now,
            updated_at=now,
        )
        db.add(index_source)

    await db.commit()

    try:
        session = aioboto3.Session()
        async with session.client("lambda") as lambda_client:
            payload = {
                "domain": stripped_domain,
                "eventType": "indexRepo",
                "repoUrls": request.repo_urls,
            }

            response = await lambda_client.invoke(
                FunctionName=LAMBDA_FUNCTION_NAME,
                InvocationType="Event",
                Payload=json.dumps(payload),
            )

            logger.info(
                f"Successfully invoked code indexing Lambda. "
                f"StatusCode: {response.get('StatusCode')}, "
                f"Domain: {stripped_domain}, "
                f"RepoUrls: {request.repo_urls}, "
                f"JobId: {job_id}"
            )

    except ClientError as e:
        logger.error(
            f"Failed to invoke code indexing Lambda: {e.response['Error']['Code']} - {e.response['Error']['Message']}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to start indexing job")
    except Exception as e:
        logger.error(f"Unexpected error invoking code indexing Lambda: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start indexing job")

    return IndexGithubResponse(job_id=job_id, repo_urls=request.repo_urls)
