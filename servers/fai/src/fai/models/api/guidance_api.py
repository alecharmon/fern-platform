from pydantic import (
    BaseModel,
    Field,
)

from src.fai.models.api.commons.pagination import PaginationResponse
from src.fai.models.types.guidance_types import Guidance


class CreateGuidanceRequest(BaseModel):
    context: list[str] = Field(
        description=(
            "The context of the guidance document, as a list of strings, that will be indexed. "
            "Each string will be vectorized separately to generate a separate record."
        )
    )
    document: str = Field(
        description="The content of the guidance document that will be returned to Ask Fern during Ask Fern retrieval."
    )


class CreateGuidanceResponse(BaseModel):
    guidance_id: str = Field(description="The unique identifier of the created guidance document")


class UpdateGuidanceRequest(BaseModel):
    context: list[str] | None = Field(
        default=None,
        description=(
            "The updated context of the guidance document, as a list of strings, that will be indexed. "
            "If not provided, this field will remain unchanged."
        ),
    )
    document: str | None = Field(
        default=None,
        description=(
            "The updated content of the guidance document that will be returned to Ask Fern during Ask Fern retrieval. "
            "If not provided, this field will remain unchanged."
        ),
    )


class UpdateGuidanceResponse(BaseModel):
    guidance: Guidance = Field(description="The updated guidance document")


class DeleteGuidanceResponse(BaseModel):
    success: bool = Field(description="Whether the guidance document was successfully deleted")


class GetGuidanceResponse(BaseModel):
    guidance: Guidance = Field(description="The requested guidance document")


class GetGuidancesResponse(BaseModel):
    guidances: list[Guidance] = Field(description="List of guidance documents for the domain")
    pagination: PaginationResponse = Field(description="Pagination information for the guidance document list")
