from pydantic import (
    BaseModel,
    Field,
)

from fai.models.api.commons.pagination import PaginationResponse
from fai.models.types.website_types import Website


class IndexWebsiteRequest(BaseModel):
    base_url: str = Field(description="The base URL to start indexing from (e.g., 'https://docs.example.com')")
    domain_filter: str | None = Field(
        default=None, description="Domain to filter crawling (e.g., 'docs.example.com'). Defaults to base_url domain."
    )
    path_filter: str | None = Field(
        default=None,
        description="Path prefix to restrict crawling (e.g., '/docs'). Only URLs starting with this will be crawled.",
    )
    url_pattern: str | None = Field(
        default=None,
        description="Regex pattern to filter URLs (e.g., `https://example\\.com/(docs|api)/.*`).",
    )
    chunk_size: int | None = Field(default=1000, description="Size of text chunks for splitting documents")
    chunk_overlap: int | None = Field(default=200, description="Overlap between consecutive chunks")
    min_content_length: int | None = Field(default=100, description="Minimum content length to index a page")
    max_pages: int | None = Field(default=None, description="Maximum number of pages to crawl. None means unlimited.")
    delay: float | None = Field(default=1.0, description="Delay in seconds between requests")
    version: str | None = Field(default=None, description="Version to tag all indexed pages with")
    product: str | None = Field(default=None, description="Product to tag all indexed pages with")
    authed: bool | None = Field(default=None, description="Whether indexed pages should be auth-gated")


class IndexWebsiteResponse(BaseModel):
    job_id: str = Field(description="ID to track the indexing job status")
    base_url: str = Field(description="The base URL being indexed")


class GetWebsiteStatusResponse(BaseModel):
    job_id: str
    status: str = Field(description="Job status: PENDING, PROCESSING, COMPLETED, or FAILED")
    base_url: str
    pages_indexed: int = Field(description="Number of pages successfully indexed")
    pages_failed: int = Field(description="Number of pages that failed to index")
    error: str | None = Field(default=None, description="Error message if the job failed")


class GetWebsiteResponse(BaseModel):
    website: Website = Field(description="The requested website")


class GetWebsitesResponse(BaseModel):
    websites: list[Website] = Field(description="List of indexed website pages for the domain")
    pagination: PaginationResponse = Field(description="Pagination information for the website list")


class ReindexWebsiteRequest(BaseModel):
    base_url: str = Field(description="The base URL to re-crawl (will delete old pages and re-index)")
    domain_filter: str | None = Field(
        default=None,
        description="Domain to filter crawling (e.g., 'docs.example.com'). If not provided, uses previous config.",
    )
    path_filter: str | None = Field(
        default=None,
        description="Path prefix to restrict crawling (e.g., '/docs'). If not provided, uses previous config.",
    )
    url_pattern: str | None = Field(
        default=None,
        description=(
            "Regex pattern to filter URLs (e.g., `https://example\\.com/(docs|api)/.*`). "
            "If not provided, uses previous config."
        ),
    )
    chunk_size: int | None = Field(
        default=None, description="Size of text chunks for splitting documents. If not provided, uses previous config."
    )
    chunk_overlap: int | None = Field(
        default=None, description="Overlap between consecutive chunks. If not provided, uses previous config."
    )
    min_content_length: int | None = Field(
        default=None, description="Minimum content length to index a page. If not provided, uses previous config."
    )
    max_pages: int | None = Field(
        default=None, description="Maximum number of pages to crawl. If not provided, uses previous config."
    )
    delay: float | None = Field(
        default=None, description="Delay in seconds between requests. If not provided, uses previous config."
    )
    version: str | None = Field(
        default=None, description="Version to tag all indexed pages with. If not provided, uses previous config."
    )
    product: str | None = Field(
        default=None, description="Product to tag all indexed pages with. If not provided, uses previous config."
    )
    authed: bool | None = Field(
        default=None, description="Whether indexed pages should be auth-gated. If not provided, uses previous config."
    )


class ReindexWebsiteResponse(BaseModel):
    job_id: str = Field(description="ID to track the re-crawling job status")
    base_url: str = Field(description="The base URL being re-crawled")


class DeleteWebsiteRequest(BaseModel):
    base_url: str = Field(description="The base URL of the website to delete (deletes all pages from this source)")


class DeleteWebsiteResponse(BaseModel):
    success: bool = Field(description="Whether the website was successfully deleted")
    pages_deleted: int = Field(description="Number of pages deleted")


class DeleteAllWebsitesResponse(BaseModel):
    success: bool = Field(description="Whether all websites were successfully deleted")
    pages_deleted: int = Field(description="Total number of pages deleted")
