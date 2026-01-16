"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

export function TokenRefresher() {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const checkToken = async () => {
            try {
                const response = await fetch("/api/auth/refresh", {
                    credentials: "include"
                });

                const data = await response.json();

                if (!data.success) {
                    console.log("[TokenRefresher] Token invalid, logging out");
                    window.location.href = "/api/logout";
                }
            } catch (error) {
                console.error("[TokenRefresher] Error checking token:", error);
            }
        };

        // Check on mount
        checkToken();

        // Set up periodic checks
        intervalRef.current = setInterval(checkToken, CHECK_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return null;
}
