from enum import Enum

QUERY_INDEX_NAME = "query"


class DataIndexNames(Enum):
    FERN_DOCS = "fern_docs"
    DOCUMENT = "document"
    GUIDANCE = "guidance"
    CODE = "code"
    SLACK_CONTEXT = "slack_context"
