/**
 * Utility function to measure the execution time of an async function.
 * Returns a tuple of [result, durationMs].
 *
 * @example
 * const [result, durationMs] = await measureAsync(() => fetchData());
 * console.log(`Operation took ${durationMs}ms`);
 */
export async function measureAsync<T>(fn: () => Promise<T>): Promise<[T, number]> {
    const start = Date.now();
    const result = await fn();
    return [result, Date.now() - start];
}
