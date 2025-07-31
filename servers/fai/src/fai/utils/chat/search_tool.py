from pydantic import BaseModel


class SearchToolInput(BaseModel):
    query: str


search_tool = {
    "name": "search",
    "description": "Search the knowledge base for the user's query. Semantic search is enabled.",
    "input_schema": SearchToolInput.schema(),
}
