from pydantic import (
    BaseModel,
    Field,
)


class GetMcpSemanticQueryRequest(BaseModel):
    semantic_query: str = Field(description="The semantic query to get the documents for")


class GetMcpSemanticQueryResponse(BaseModel):
    documents: list[str] = Field(description="A list of documents that are semantically relevant to the query")


class GetMcpBmfQueryRequest(BaseModel):
    keywords: str = Field(description="The bm25 keywords to get the documents for")


class GetMcpBmfQueryResponse(BaseModel):
    documents: list[str] = Field(description="A list of documents that are relevant to the keyword")
