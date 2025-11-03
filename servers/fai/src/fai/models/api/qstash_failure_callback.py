from pydantic import (
    BaseModel,
    Field,
)


class QStashFailureCallback(BaseModel):
    model_config = {"extra": "ignore"}

    dlq_id: str = Field(alias="dlqId")
    url: str
    status: int
    source_header: dict[str, str | list[str]] = Field(default_factory=dict, alias="sourceHeader")


class QStashFailureCallbackResponse(BaseModel):
    success: bool
