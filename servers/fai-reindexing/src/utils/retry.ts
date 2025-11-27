export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: () => true
};

/**
 * Exponential backoff retry utility
 *
 * @example
 * const result = await withRetry(
 *   async () => await apiCall(),
 *   { maxAttempts: 5, initialDelayMs: 500 }
 * );
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: unknown;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (!opts.retryableErrors(error)) {
                throw error;
            }

            if (attempt === opts.maxAttempts) {
                break;
            }

            const delay = Math.min(
                opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
                opts.maxDelayMs
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}
