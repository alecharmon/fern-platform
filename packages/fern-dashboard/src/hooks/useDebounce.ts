import { useCallback, useEffect, useRef } from "react";

/**
 * Hook that returns a debounced version of the provided function with flush guarantees.
 * The debounced function will only execute after the specified delay has passed without
 * it being called again. CRITICAL: This hook guarantees that the last pending call will
 * execute before unmount, preventing data loss.
 *
 * @param callback The function to debounce
 * @param delay The delay in milliseconds
 * @param maxWait Maximum time to wait before forcing execution (optional)
 * @returns An object with the debounced callback and a flush method
 */
export function useDebounce<T extends (...args: any[]) => any>(
    callback: T,
    delay: number,
    maxWait?: number
): { debouncedCallback: T; flush: () => void } {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);
    const pendingArgsRef = useRef<Parameters<T> | null>(null);

    // Keep the callback ref up to date
    callbackRef.current = callback;

    // Flush function that executes any pending call immediately
    const flush = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (maxWaitTimeoutRef.current) {
            clearTimeout(maxWaitTimeoutRef.current);
            maxWaitTimeoutRef.current = null;
        }

        if (pendingArgsRef.current) {
            const args = pendingArgsRef.current;
            pendingArgsRef.current = null;
            callbackRef.current(...args);
        }
    }, []);

    // Cleanup: flush pending calls before unmount to prevent data loss
    useEffect(() => {
        return () => {
            flush();
        };
    }, [flush]);

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            // Store the latest arguments for potential flush
            pendingArgsRef.current = args;

            // Clear existing debounce timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Start maxWait timer if specified and not already running
            if (maxWait && !maxWaitTimeoutRef.current) {
                maxWaitTimeoutRef.current = setTimeout(() => {
                    maxWaitTimeoutRef.current = null;
                    flush();
                }, maxWait);
            }

            // Set new debounce timeout
            timeoutRef.current = setTimeout(() => {
                // Clear maxWait timer when debounce executes
                if (maxWaitTimeoutRef.current) {
                    clearTimeout(maxWaitTimeoutRef.current);
                    maxWaitTimeoutRef.current = null;
                }
                // Use pendingArgsRef to get the latest args, not the captured closure args
                if (pendingArgsRef.current) {
                    const latestArgs = pendingArgsRef.current;
                    pendingArgsRef.current = null;
                    callbackRef.current(...latestArgs);
                }
            }, delay);
        },
        [delay, maxWait, flush]
    ) as T;

    return { debouncedCallback, flush };
}
