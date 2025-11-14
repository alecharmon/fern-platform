from enum import Enum
from typing import Any

from turbopuffer.types.row import Row


class ChatMode(str, Enum):
    MARKDOWN = "markdown"
    SLACK_CHAT = "slack_chat"
    SLACK_INDEX = "slack_index"
    DISCORD = "discord"


def deduplicate_retrieved_sources(query_results_list: list[list[Row]]) -> list[Row]:
    """
    Deduplicate retrieved sources by ID and URL, keeping the highest scoring result for each.

    Args:
        query_results_list: List of query results, where each query result is a list of Row objects

    Returns:
        List of deduplicated Row objects
    """
    chunks_by_id: dict[int, Row] = {}
    for query_results in query_results_list:
        for row in query_results:
            if row.id not in chunks_by_id:
                chunks_by_id[row.id] = row
            elif hasattr(row, "score") and row.score is not None:
                existing_score = getattr(chunks_by_id[row.id], "score", None)
                if existing_score is None or row.score > existing_score:
                    chunks_by_id[row.id] = row

    chunks_by_url: dict[str, Row] = {}
    for row in chunks_by_id.values():
        url = getattr(row, "url", None)
        if url:
            if url not in chunks_by_url:
                chunks_by_url[url] = row
            elif hasattr(row, "score") and row.score is not None:
                existing_score = getattr(chunks_by_url[url], "score", None)
                if existing_score is None or row.score > existing_score:
                    chunks_by_url[url] = row
        else:
            chunks_by_url[f"__no_url_{row.id}"] = row

    return list(chunks_by_url.values())


def format_record(record: Row | Any) -> str:
    document = getattr(record, "document", "")
    url = getattr(record, "url", "")

    if url:
        return f"{document}\nSource: {url}"
    return document
