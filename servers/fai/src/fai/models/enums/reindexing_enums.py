from enum import Enum


class ReindexingJobStatus(str, Enum):
    """Job status enum for tracking reindexing job lifecycle"""

    QUEUED = "queued"
    RECEIVED = "received"
    UPSERTING = "upserting"
    SYNCING = "syncing"
    COMPLETED = "completed"
    FAILED = "failed"
    OOM_RETRY = "oom_retry"
