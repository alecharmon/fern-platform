"""Query rewriting and decomposition for improved RAG retrieval."""

from pydantic import BaseModel

from fai.settings import LOGGER
from fai.utils.generate_model import generate_cached_anthropic_generic_async

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
    """Response model for query decomposition."""

    reasoning: str
    sub_queries: list[str]


async def rewrite_query(user_query: str) -> list[str]:
    """
    Decompose a user query into multiple sub-queries for better RAG retrieval.

    If the query is already sufficiently condensed/optimized, returns the original query.
    Otherwise, decomposes it into 3-4 relevant sub-questions that address different facets.

    Args:
        user_query: The original user query to decompose

    Returns:
        A list of sub-queries (or just the original query if decomposition isn't needed)
    """
    try:
        result = await generate_cached_anthropic_generic_async(
            response_type=QueryDecompositionResponse,
            system_prompt=QUERY_DECOMPOSITION_SYSTEM_PROMPT,
            user_prompt=QUERY_DECOMPOSITION_USER_PROMPT,
            model="claude-haiku-4-5",
            user_query=user_query,
        )

        if result is None or len(result.sub_queries) == 0:
            LOGGER.warning("Query decomposition returned no sub-queries, using original query")
            return [user_query]

        LOGGER.info(f"Successfully decomposed query into {len(result.sub_queries)} sub-queries")
        return result.sub_queries

    except Exception as e:
        LOGGER.exception(f"Error in query rewriting: {e}, using original query")
        return [user_query]
