from pydantic import (
    BaseModel,
    Field,
)

from fai.models.db.index_source_db import IndexSourceStatus


class IndexGithubRequest(BaseModel):
    repo_urls: list[str] = Field(description="GitHub repository URLs to index")


class IndexGithubResponse(BaseModel):
    job_id: str = Field(description="Job ID for tracking indexing progress")
    repo_urls: list[str] = Field(description="GitHub repository URLs being indexed")


class GithubIndexStatusResponse(BaseModel):
    status: IndexSourceStatus = Field(description="Current indexing status")
    pages_indexed: int = Field(description="Number of pages successfully indexed")
    pages_failed: int = Field(description="Number of pages that failed to index")


class ReindexGithubRequest(BaseModel):
    repo_url: str = Field(description="GitHub repository URL to reindex")


class ReindexGithubResponse(BaseModel):
    job_id: str = Field(description="New job ID for tracking reindexing progress")
