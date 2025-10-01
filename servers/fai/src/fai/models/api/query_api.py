from datetime import datetime

from pydantic import (
    BaseModel,
    Field,
)

from fai.models.api.commons.pagination import PaginationResponse
from fai.models.types.query_types import Query


class CreateQueryRequest(BaseModel):
    query_id: str = Field(description="Unique identifier for the query")
    conversation_id: str = Field(description="Identifier of the conversation this query belongs to")
    domain: str = Field(description="The domain where this query was made")
    text: str = Field(description="The text content of the query")
    role: str = Field(description="The role of the query sender (user or assistant)")
    source: str = Field(description="The source system that generated this query")
    created_at: datetime = Field(description="Timestamp when the query was created")
    time_to_first_token: float | None = Field(
        default=None,
        description="Time in seconds until first token was received. Only specified for Assistant responses.",
    )


class CreateQueryResponse(BaseModel):
    query_id: str = Field(description="Unique identifier for the query")


class GetQueriesResponse(BaseModel):
    queries: list[Query] = Field(description="List of queries matching the request criteria")
    pagination: PaginationResponse = Field(description="Pagination information")
