from typing import Any

from pydantic import (
    BaseModel,
    Field,
)

from ..retrieval.filters import QueryFilters
from ..retrieval.interface import (
    RAGRetriever,
    RetrievalQuery,
)
from .models import (
    Tool,
    ToolDefinition,
    ToolParameter,
)


class FormattedSearchResult(BaseModel):
    document: str = Field(..., description="The document content")
    title: str | None = Field(default=None, description="The document title")
    url: str | None = Field(default=None, description="The document URL")
    product: str | None = Field(default=None, description="The product identifier")
    source: str | None = Field(default=None, description="The source identifier")


def create_documentation_search_tool(
    retriever: RAGRetriever,
    domain: str,
    filters: QueryFilters | None = None,
    top_k: int = 5,
    max_calls: int = 2,
    already_retrieved_urls: set[str] | None = None,
) -> Tool:
    urls_to_ignore: set[str] = already_retrieved_urls.copy() if already_retrieved_urls else set()

    async def execute(arguments: dict[str, Any]) -> list[dict[str, Any]]:
        query = arguments.get("query", "")
        if not query:
            return []

        existing_urls_to_ignore = list(filters.urls_to_ignore) if filters and filters.urls_to_ignore else []
        combined_urls_to_ignore = list(urls_to_ignore) + existing_urls_to_ignore

        query_filters = QueryFilters(
            facet_filters=filters.facet_filters if filters else [],
            exploded_roles=filters.exploded_roles if filters else [],
            document_ids_to_ignore=filters.document_ids_to_ignore if filters else [],
            urls_to_ignore=combined_urls_to_ignore,
            document_urls=filters.document_urls if filters else None,
            user_is_authed=filters.user_is_authed if filters else False,
        )

        retrieval_query = RetrievalQuery(
            query=query,
            domain=domain,
            top_k=top_k,
            filters=query_filters,
        )

        result = await retriever.retrieve(retrieval_query)

        formatted_results = []
        for doc in result.documents:
            url = doc.metadata.get("url") if doc.metadata else None
            if url:
                urls_to_ignore.add(url)

            formatted_result = FormattedSearchResult(
                document=doc.content,
                title=doc.metadata.get("title") if doc.metadata else None,
                url=url,
                product=doc.metadata.get("product") if doc.metadata else None,
                source=doc.metadata.get("source") if doc.metadata else None,
            )
            formatted_results.append(formatted_result.model_dump())

        return formatted_results

    tool_definition = ToolDefinition(
        name="documentationSearch",
        description="Search the knowledge base for the user's query with semantic search and bm25",
        parameters=[
            ToolParameter(
                name="query",
                type="string",
                description="The search query to find relevant documentation",
                required=True,
            )
        ],
    )

    return Tool(definition=tool_definition, execute=execute, max_calls=max_calls)
