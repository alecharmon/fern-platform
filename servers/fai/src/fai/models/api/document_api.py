from pydantic import (
    BaseModel,
    Field,
)

from src.fai.models.api.commons.pagination import PaginationResponse
from src.fai.models.types.document_types import Document


class CreateDocumentRequest(BaseModel):
    document: str = Field(
        description="The content of the document that will be returned to Ask Fern during document retrieval."
    )
    chunk: str | None = Field(
        default=None,
        description=(
            "The textual content that should be vectorized when indexing the document. "
            "If not provided, the full document will be vectorized."
        ),
    )
    title: str | None = Field(
        default=None,
        description="The title of the document. This will be used with the `url` when Ask Fern cites this document.",
    )
    url: str | None = Field(
        default=None,
        description="The url of the document. This will be used as the source of the document when Ask Fern cites it.",
    )
    version: str | None = Field(
        default=None,
        description=(
            "The version of the document. This will be compared against when running Ask Fern with version filters. "
            "If null, the document will be retrievable by all versions."
        ),
    )
    product: str | None = Field(
        default=None,
        description=(
            "The product of the document. This will be used to filter documents when running Ask Fern with "
            "product filters. If null, the document will be retrievable by all products."
        ),
    )
    keywords: list[str] | None = Field(
        default=None, description="The keywords of the document. Adding keywords can improve document matching."
    )
    authed: bool | None = Field(
        default=None,
        description="Whether the document is authed. If true, the document will be retrievable by all users.",
    )


class CreateDocumentResponse(BaseModel):
    document_id: str = Field(description="The unique identifier of the created document")


class UpdateDocumentRequest(BaseModel):
    document: str | None = Field(
        default=None,
        description=(
            "The updated content of the document that will be returned to Ask Fern during document retrieval. "
            "If not provided, this field will remain unchanged."
        ),
    )
    chunk: str | None = Field(
        default=None,
        description=(
            "The updated textual content that should be vectorized when indexing the document. "
            "If not provided, this field will remain unchanged."
        ),
    )
    title: str | None = Field(
        default=None,
        description="The updated title of the document. If not provided, this field will remain unchanged.",
    )
    url: str | None = Field(
        default=None, description="The updated url of the document. If not provided, this field will remain unchanged."
    )
    version: str | None = Field(
        default=None,
        description="The updated version of the document. If not provided, this field will remain unchanged.",
    )
    product: str | None = Field(
        default=None,
        description="The updated product of the document. If not provided, this field will remain unchanged.",
    )
    keywords: list[str] | None = Field(
        default=None,
        description="The updated keywords of the document. If not provided, this field will remain unchanged.",
    )
    authed: bool | None = Field(
        default=None,
        description="The updated authed status of the document. If not provided, this field will remain unchanged.",
    )


class UpdateDocumentResponse(BaseModel):
    document: Document = Field(description="The updated document")


class DeleteDocumentResponse(BaseModel):
    success: bool = Field(description="Whether the document was successfully deleted")


class GetDocumentResponse(BaseModel):
    document: Document = Field(description="The requested document")


class GetDocumentsRequest(BaseModel):
    page: int | None = Field(default=None, description="The page number for pagination")
    limit: int | None = Field(default=None, description="The number of documents per page")


class GetDocumentsResponse(BaseModel):
    documents: list[Document] = Field(description="List of documents for the domain")
    pagination: PaginationResponse = Field(description="Pagination information for the document list")
