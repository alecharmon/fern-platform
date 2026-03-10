/**
 * A wrapper around `fetch()` that automatically cancels the response body
 * after reading status metadata, preventing file descriptor leaks.
 *
 * In Node.js, an unconsumed fetch response body keeps the underlying TCP
 * socket open. When many concurrent requests are made (e.g. during
 * revalidation), this can exhaust the OS file descriptor limit and cause
 * EMFILE errors. This utility ensures the body is always released.
 *
 * @returns An object with `ok` and `status` from the response.
 */
export async function fetchAndDiscard(
    input: string | URL | Request,
    init?: RequestInit
): Promise<{ ok: boolean; status: number }> {
    const res = await fetch(input, init);
    await res.body?.cancel();
    return { ok: res.ok, status: res.status };
}
