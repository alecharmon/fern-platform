from enum import Enum


QUERY_INDEX_NAME = "query"


class DataIndexNames(Enum):
    DOCS = "text-embedding-3-large_v3"
    DOCUMENT = "document"
    GUIDANCE = "guidance"
