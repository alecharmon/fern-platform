from pydantic import (
    BaseModel,
    Field,
)

from fai.models.api.commons.pagination import PaginationResponse
from fai.models.types.code_types import Code


class CreateCodeRecordRequest(BaseModel):
    document: str = Field(
        description="The content of the code document that will be returned to Ask Fern during retrieval."
    )
    chunk: str | None = Field(
        default=None,
        description=(
            "The textual content that should be vectorized when indexing the code. "
            "If not provided, the full document will be vectorized."
        ),
    )
    title: str | None = Field(
        default=None,
        description="The title of the code document. This will be used with the `url` when Ask Fern cites this code.",
    )
    url: str | None = Field(
        default=None,
        description="The url of the code document. This will be used as the source when Ask Fern cites it.",
    )
    version: str | None = Field(
        default=None,
        description=(
            "The version of the code. This will be compared against when running Ask Fern with version filters. "
            "If null, the code will be retrievable by all versions."
        ),
    )
    product: str | None = Field(
        default=None,
        description=(
            "The product of the code. This will be used to filter code when running Ask Fern with "
            "product filters. If null, the code will be retrievable by all products."
        ),
    )
    keywords: list[str] | None = Field(
        default=None, description="The keywords of the code. Adding keywords can improve code matching."
    )
    authed: bool | None = Field(
        default=None,
        description="Whether the code is authed. If true, the code will be retrievable by all users.",
    )


class CreateCodeRecordResponse(BaseModel):
    code_id: str = Field(description="The unique identifier of the created code entry")


class DeleteCodeRecordRequest(BaseModel):
    code_id: str = Field(description="The unique identifier of the code to delete")


class DeleteCodeRecordResponse(BaseModel):
    success: bool = Field(description="Whether the code was successfully deleted")


class GetCodeRecordResponse(BaseModel):
    document: Code = Field(description="The requested code")


class GetCodeRecordsRequest(BaseModel):
    page: int | None = Field(default=None, description="The page number for pagination")
    limit: int | None = Field(default=None, description="The number of code entries per page")


class GetCodeRecordsResponse(BaseModel):
    documents: list[Code] = Field(description="List of code entries for the domain")
    pagination: PaginationResponse = Field(description="Pagination information for the code list")
