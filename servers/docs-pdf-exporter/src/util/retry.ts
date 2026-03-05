export interface RetryOptions {
    /** Maximum number of retry attempts (not counting the initial attempt). */
    maxRetries: number;
    /** Base delay in ms before the first retry. Doubles on each subsequent attempt. */
    baseDelayMs?: number;
    /** Upper bound on the delay between retries. */
    maxDelayMs?: number;
    /** Return false to skip retries and throw immediately. Defaults to always retry. */
    shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 10_000;

/**
 * Retry an async function with exponential backoff and jitter.
 *
 * The delay between attempts follows: min(baseDelay * 2^(attempt-1), maxDelay) + jitter.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
    const {
        maxRetries,
        baseDelayMs = DEFAULT_BASE_DELAY_MS,
        maxDelayMs = DEFAULT_MAX_DELAY_MS,
        shouldRetry = () => true
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt >= maxRetries || !shouldRetry(error)) {
                throw error;
            }

            const expDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
            const jitter = Math.floor(Math.random() * 200);
            await new Promise((resolve) => setTimeout(resolve, expDelay + jitter));
        }
    }

    throw lastError;
}
