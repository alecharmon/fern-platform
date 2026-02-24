import { useRouter } from "@bprogress/next/app";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseBackgroundPollerOptions {
    /**
     * Maximum time to poll in the background (in milliseconds)
     * @default 30 minutes (1800000ms)
     */
    maxPollingTime?: number;

    /**
     * Interval between polls (in milliseconds)
     * @default 30 seconds (30000ms)
     */
    pollingInterval?: number;

    /**
     * Whether to refresh the page on success
     * @default true
     */
    refreshOnSuccess?: boolean;

    /**
     * Whether to automatically start polling when the hook is mounted
     * @default false
     */
    autoStart?: boolean;
}

export interface UseBackgroundPollerResult {
    /**
     * Whether the poller is currently active
     */
    isPolling: boolean;

    /**
     * Start the background poller
     */
    startPolling: () => void;

    /**
     * Stop the background poller
     */
    stopPolling: () => void;
}

/**
 * A hook for background polling with page visibility detection.
 *
 * This hook:
 * - Polls at a specified interval in the background
 * - Checks immediately when the user returns to the page (visibility change)
 * - Automatically stops after a maximum polling time
 * - Optionally refreshes the page on success
 *
 * @example
 * ```tsx
 * const { isPolling, startPolling } = useBackgroundPoller(async () => {
 *   const result = await checkSomething();
 *   return result.success; // Return true to stop polling
 * });
 *
 * const handleAction = async () => {
 *   await doSomething();
 *   startPolling(); // Start polling after the action
 * };
 * ```
 */
export function useBackgroundPoller(
    /**
     * The callback function to poll. Should return a promise that resolves to:
     * - `true` to stop polling (success)
     * - `false` to continue polling
     */
    checkFn: () => Promise<boolean>,
    options: UseBackgroundPollerOptions = {}
): UseBackgroundPollerResult {
    const {
        maxPollingTime = 30 * 60 * 1000, // 30 minutes
        pollingInterval = 30 * 1000, // 30 seconds
        refreshOnSuccess = true,
        autoStart = false
    } = options;

    const router = useRouter();
    const [isPolling, setIsPolling] = useState(false);
    const [pageIsActive, setPageIsActive] = useState(true);
    const startedPollingAt = useRef<number | undefined>(undefined);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        startedPollingAt.current = undefined;
        setIsPolling(false);

        // Refresh page when refreshOnSuccess is enabled, regardless of success status
        // This ensures UI state is reset even on timeout
        if (refreshOnSuccess) {
            router.refresh();
        }
    }, [router, refreshOnSuccess]);

    const checkCondition = useCallback(async () => {
        try {
            const success = await checkFn();
            if (success) {
                stopPolling();
            }
        } catch (error) {
            console.error("[useBackgroundPoller] Error in checkFn:", error);
        }
    }, [checkFn, stopPolling]);

    const startPolling = useCallback(() => {
        // If already polling, don't start again
        if (isPolling || intervalRef.current) {
            return;
        }

        startedPollingAt.current = Date.now();
        setIsPolling(true);

        // Clear any existing interval (shouldn't happen, but just in case)
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            if (startedPollingAt.current == null) {
                console.warn("[useBackgroundPoller] startedPollingAt.current is null");
                stopPolling();
                return;
            }

            // Stop polling after max time
            if (Date.now() - startedPollingAt.current > maxPollingTime) {
                console.warn("[useBackgroundPoller] maxPollingTime reached. Stopping poller.");
                stopPolling();
                return;
            }

            void checkCondition();
        }, pollingInterval);

        // Check immediately on start
        void checkCondition();
    }, [isPolling, pollingInterval, maxPollingTime, checkCondition, stopPolling]);

    // Track page visibility and check condition when user returns
    useEffect(() => {
        const handleVisibilityChange = () => {
            const isNowActive = !document.hidden;
            if (pageIsActive !== isNowActive) {
                // If the page just became visible and we're polling, check immediately
                if (isNowActive && isPolling) {
                    void checkCondition();
                }
                setPageIsActive(isNowActive);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [pageIsActive, isPolling, checkCondition]);

    // Auto-start if requested
    // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount, not when deps change
    useEffect(() => {
        if (autoStart) {
            startPolling();
        }
    }, []); // Only run on mount

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        isPolling,
        startPolling,
        stopPolling
    };
}
