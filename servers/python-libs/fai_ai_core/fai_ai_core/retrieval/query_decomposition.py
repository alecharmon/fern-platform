import asyncio
import logging
import os
from functools import lru_cache

from anthropic import AsyncAnthropic
from anthropic.types import ToolParam
from anthropic.types.tool_choice_tool_param import ToolChoiceToolParam
from pydantic import BaseModel

logger = logging.getLogger(__name__)

DEFAULT_DECOMPOSITION_MODEL = "claude-haiku-4-5-20251001"

# ruff: noqa: E501
QUERY_DECOMPOSITION_SYSTEM_PROMPT = """You are an expert query decomposition system for a company-specific RAG pipeline.

Your role is to analyze user queries and generate optimal sub-queries that maximize retrieval
precision and recall from the knowledge base.

<query_analysis>
First, classify the query type:

1. DEFINITION/CONCEPT queries (What is X? Define Y)
   → Return original query unchanged

2. SIMPLE FACTUAL queries (single, direct answer needed)
   → Return original query unchanged or with minor clarification

3. COMPLEX MULTI-ASPECT queries (multiple components, comparison, troubleshooting)
   → Decompose into 3-5 focused sub-queries
</query_analysis>

<decomposition_principles>
When decomposition is needed, generate sub-queries that:

1. **Isolate distinct concepts**: Each sub-query targets ONE specific aspect, component, or entity
2. **Use retrieval-optimized language**: Phrase as noun phrases or short declarative statements, not questions
3. **Preserve critical identifiers**: Maintain exact product names, version numbers, error codes, and technical terms
4. **Progress from general to specific**: Start with broader context, then narrow to details
5. **Avoid redundancy**: Each sub-query must retrieve unique information
6. **Use keyword-rich phrasing**: Include terms likely to appear in documentation
7. **Extract error details separately**: Isolate error messages, codes, and symptoms as distinct queries
</decomposition_principles>

<output_format>
Return ONLY a JSON array of strings:
["sub-query 1", "sub-query 2", "sub-query 3"]

Each sub-query should be:
- Concise (5-15 words)
- Standalone and self-contained
- Phrased for semantic search optimization
- Free of question words when possible (use declarative form)
</output_format>

<examples>
Input: "What is Fern?"
Output: ["What is Fern?"]
Rationale: Simple definition query - no decomposition needed

Input: "How do I authenticate API requests and handle rate limiting?"
Output: [
    "API authentication methods and configuration",
    "Rate limiting implementation and policies",
    "Retry logic for rate-limited requests",
    "Authentication error handling"
]
Rationale: Multi-aspect query decomposed into distinct technical components

Input: "Why am I getting a 403 error when deploying to production with environment variables set?"
Output: [
    "403 forbidden error causes and solutions",
    "Production deployment configuration requirements",
    "Environment variable setup for deployment",
    "Authentication and authorization in production",
    "Deployment troubleshooting 403 errors"
]
Rationale: Troubleshooting query with error code, context, and multiple potential failure points

Input: "Compare REST API vs GraphQL implementation"
Output: [
    "REST API implementation guide",
    "GraphQL API implementation guide",
    "REST vs GraphQL feature comparison",
    "Performance differences REST GraphQL"
]
Rationale: Comparison query requiring information about both options plus comparative analysis

Input: "Best practices for structuring large projects"
Output: [
    "Project structure best practices",
    "Directory organization for large projects",
    "File naming conventions and standards"
]
Rationale: Broad best-practices query decomposed into specific organizational aspects
</examples>

<critical_guidelines>
- DO NOT add conversational elements or explanations
- DO NOT include "for Fern" or company name unless it's essential for disambiguation
- DO NOT create more than 5 sub-queries (optimal is 3-4)
- DO NOT use complex sentence structures - keep queries simple
- DO use technical terminology exactly as it appears in the query
- DO extract version numbers, error codes, and product names as separate search terms when relevant
- DO consider implicit information needs (e.g., "deployment issues" implies need for
  deployment prerequisites, common errors, and debugging steps)
</critical_guidelines>
"""

QUERY_DECOMPOSITION_USER_PROMPT = "Decompose this query: {user_query}"


class QueryDecompositionResponse(BaseModel):
    reasoning: str
    sub_queries: list[str]


class QueryDecomposer:
    def __init__(self, model: str = DEFAULT_DECOMPOSITION_MODEL, api_key: str | None = None):
        self._model = model
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self._api_key:
            raise ValueError("Anthropic API key is required for query decomposition")

    async def decompose(self, query: str) -> list[str]:
        try:
            async with AsyncAnthropic(api_key=self._api_key) as client:
                formatted_prompt = QUERY_DECOMPOSITION_USER_PROMPT.format(user_query=query)
                tools: list[ToolParam] = [
                    {
                        "name": "build_response_result",
                        "description": "Build the structured response object.",
                        "input_schema": QueryDecompositionResponse.model_json_schema(),
                    }
                ]
                tool_choice: ToolChoiceToolParam = {"type": "tool", "name": "build_response_result"}

                tries = 0
                while tries < 3:
                    try:
                        response = await client.messages.create(
                            model=self._model,
                            max_tokens=1000,
                            temperature=0.0,
                            system=[
                                {
                                    "type": "text",
                                    "text": QUERY_DECOMPOSITION_SYSTEM_PROMPT,
                                    "cache_control": {"type": "ephemeral"},
                                }
                            ],
                            messages=[{"role": "user", "content": formatted_prompt}],
                            tools=tools,
                            tool_choice=tool_choice,
                        )

                        function_call = response.content[0].input  # type: ignore
                        parsed_response = QueryDecompositionResponse(**function_call)

                        if not parsed_response.sub_queries:
                            logger.warning("Query decomposition returned no sub-queries, using original query")
                            return [query]

                        logger.info(
                            f"Successfully decomposed query into {len(parsed_response.sub_queries)} sub-queries"
                        )
                        return parsed_response.sub_queries

                    except Exception:
                        await asyncio.sleep(0.5)
                        tries += 1

                logger.warning("Query decomposition failed after 3 retries, using original query")
                return [query]

        except Exception as e:
            logger.exception(f"Error in query decomposition: {e}, using original query")
            return [query]


@lru_cache(maxsize=4)
def get_query_decomposer(model: str = DEFAULT_DECOMPOSITION_MODEL, api_key: str | None = None) -> QueryDecomposer:
    return QueryDecomposer(model=model, api_key=api_key)


async def decompose_query(query: str, model: str = DEFAULT_DECOMPOSITION_MODEL) -> list[str]:
    decomposer = get_query_decomposer(model=model)
    return await decomposer.decompose(query)
