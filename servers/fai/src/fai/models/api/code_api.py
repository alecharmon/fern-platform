from pydantic import (
    BaseModel,
    Field,
)

from fai.models.api.commons.pagination import PaginationResponse
from fai.models.types.code_types import Code


class CreateCodeRequest(BaseModel):
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


class CreateCodeResponse(BaseModel):
    code_id: str = Field(description="The unique identifier of the created code entry")


class DeleteCodeRequest(BaseModel):
    code_id: str = Field(description="The unique identifier of the code to delete")


class UpdateCodeRequest(BaseModel):
    document: str | None = Field(
        default=None,
        description=(
            "The updated content of the code that will be returned to Ask Fern during retrieval. "
            "If not provided, this field will remain unchanged."
        ),
    )
    chunk: str | None = Field(
        default=None,
        description=(
            "The updated textual content that should be vectorized when indexing the code. "
            "If not provided, this field will remain unchanged."
        ),
    )
    title: str | None = Field(
        default=None,
        description="The updated title of the code. If not provided, this field will remain unchanged.",
    )
    url: str | None = Field(
        default=None, description="The updated url of the code. If not provided, this field will remain unchanged."
    )
    version: str | None = Field(
        default=None,
        description="The updated version of the code. If not provided, this field will remain unchanged.",
    )
    product: str | None = Field(
        default=None,
        description="The updated product of the code. If not provided, this field will remain unchanged.",
    )
    keywords: list[str] | None = Field(
        default=None,
        description="The updated keywords of the code. If not provided, this field will remain unchanged.",
    )
    authed: bool | None = Field(
        default=None,
        description="The updated authed status of the code. If not provided, this field will remain unchanged.",
    )


class UpdateCodeResponse(BaseModel):
    code: Code = Field(description="The updated code")


class DeleteCodeResponse(BaseModel):
    success: bool = Field(description="Whether the code was successfully deleted")


class GetCodeResponse(BaseModel):
    document: Code = Field(description="The requested code")


class GetCodeEntriesRequest(BaseModel):
    page: int | None = Field(default=None, description="The page number for pagination")
    limit: int | None = Field(default=None, description="The number of code entries per page")


class GetCodeEntriesResponse(BaseModel):
    documents: list[Code] = Field(description="List of code entries for the domain")
    pagination: PaginationResponse = Field(description="Pagination information for the code list")
