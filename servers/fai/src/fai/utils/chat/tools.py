from pydantic import BaseModel


class SearchToolInput(BaseModel):
    query: str


SEARCH_TOOL = {
    "name": "search",
    "description": "Search the knowledge base for the user's query. Semantic search is enabled.",
    "input_schema": SearchToolInput.model_json_schema(),
}
