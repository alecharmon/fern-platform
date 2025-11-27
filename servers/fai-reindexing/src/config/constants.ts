/**
 * Retry and timeout constants for the reindexing service
 */

export const RETRY_CONFIG = {
    /** Maximum number of retry attempts for ECS task launches */
    MAX_ATTEMPTS: 3,
    /** Delay between ECS task launch retries (10 seconds) */
    ECS_RETRY_DELAY_MS: 10_000,
    /** Delay between sync retry attempts (15 seconds) */
    SYNC_RETRY_DELAY_MS: 15_000
} as const;

export const POLLING_CONFIG = {
    /** Delay when no messages are available in the queue (1 second) */
    NO_MESSAGES_DELAY_MS: 1_000,
    /** Delay after error during queue polling (5 seconds) */
    ERROR_DELAY_MS: 5_000,
    /** Maximum concurrent jobs the scheduler can process */
    MAX_CONCURRENT_JOBS: 10
} as const;
