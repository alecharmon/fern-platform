from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fai.models.api.website_api import IndexWebsiteRequest


@dataclass
class DocumentChunk:
    content: str
    metadata: dict[str, str | int | list[str] | None]
    full_document: str

    def to_dict(self) -> dict[str, str | dict[str, str | int | list[str] | None]]:
        return {"content": self.content, "metadata": self.metadata, "full_document": self.full_document}


@dataclass
class WebsiteCrawlConfig:
    """Configuration for website crawling jobs."""

    base_url: str
    domain_filter: str | None = None
    path_filter: str | None = None
    url_pattern: str | None = None
    max_pages: int | None = None
    delay: float = 1.0
    chunk_size: int = 1000
    chunk_overlap: int = 200
    min_content_length: int = 100
    version: str | None = None
    product: str | None = None
    authed: bool = False

    @classmethod
    def from_index_request(cls, request: "IndexWebsiteRequest") -> "WebsiteCrawlConfig":
        """
        Create a WebsiteCrawlConfig from an IndexWebsiteRequest.
        Uses config defaults if request fields are None.
        """
        return cls(
            base_url=request.base_url,
            domain_filter=request.domain_filter,
            path_filter=request.path_filter,
            url_pattern=request.url_pattern,
            max_pages=request.max_pages,
            # Use config defaults if request fields are None
            delay=request.delay if request.delay is not None else 1.0,
            chunk_size=request.chunk_size if request.chunk_size is not None else 1000,
            chunk_overlap=request.chunk_overlap if request.chunk_overlap is not None else 200,
            min_content_length=request.min_content_length if request.min_content_length is not None else 100,
            version=request.version,
            product=request.product,
            authed=request.authed if request.authed is not None else False,
        )
