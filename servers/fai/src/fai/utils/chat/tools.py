from pydantic import BaseModel


class SearchToolInput(BaseModel):
    query: str


class SaveSlackContextToolInput(BaseModel):
    question: str
    ideal_response: str


SEARCH_TOOL_ANTHROPIC = {
    "name": "search",
    "description": "Search the knowledge base for the user's query. Semantic search is enabled.",
    "input_schema": SearchToolInput.model_json_schema(),
}

SAVE_SLACK_CONTEXT_TOOL_ANTHROPIC = {
    "name": "save_slack_context",
    "description": (
        "Save a question and ideal response pair to improve future bot responses. "
        "Only call this tool after the user has explicitly confirmed they want to save the context. "
        "The question should be a clear, standalone question that users might ask. "
        "The ideal_response should be the precise answer the bot should give for this question."
    ),
    "input_schema": SaveSlackContextToolInput.model_json_schema(),
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
