from pydantic import BaseModel


class SearchToolInput(BaseModel):
    query: str


SEARCH_TOOL_ANTHROPIC = {
    "name": "search",
    "description": "Search the knowledge base for the user's query. Semantic search is enabled.",
    "input_schema": SearchToolInput.model_json_schema(),
}

SEARCH_TOOL_COHERE = {
    "type": "function",
    "function": {
        "name": "search",
        "description": "Search the knowledge base for the user's query. Semantic search is enabled.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "the query to search the knowledge base.",
                }
            },
            "required": ["query"],
        },
    },
}
