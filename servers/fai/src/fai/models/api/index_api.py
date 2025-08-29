from pydantic import (
    BaseModel,
    Field,
)


class ReconstructIndexResponse(BaseModel):
    success: bool = Field(description="Whether the query index reconstruction was successful")


class SyncIndexRequest(BaseModel):
    index_name: str = Field(description="The name of the index to sync")


class SyncIndexResponse(BaseModel):
    success: bool = Field(description="Whether the index sync was successful")
