"use client";

import { useEffect, useRef } from "react";

interface MetricsCardProps {
    title: string;
    value: number;
    isLoading: boolean;
    error: Error | null;
    className?: string;
}

export function MetricsCard({ title, value, isLoading, error, className }: MetricsCardProps) {
    const countupRef = useRef<HTMLDivElement>(null);
    const countUpAnimRef = useRef<any>(null);
    const previousValueRef = useRef<number>(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when value, isLoading, and error change
    useEffect(() => {
        // Only initialize CountUp when we have data and it's not loading
        if (!isLoading && !error && countupRef.current) {
            initCountUp();
        }

        // Cleanup function to reset/stop any running animations
        return () => {
            if (countUpAnimRef.current) {
                countUpAnimRef.current.reset();
            }
        };
    }, [value, isLoading, error]);

    async function initCountUp() {
        if (!countupRef.current) {
            return;
        }

        try {
            const countUpModule = await import("countup.js");

            // Reset previous animation if it exists
            if (countUpAnimRef.current) {
                countUpAnimRef.current.reset();
            }

            const startValue = previousValueRef.current;

            // Create new CountUp instance
            countUpAnimRef.current = new countUpModule.CountUp(countupRef.current, value, {
                startVal: startValue,
                duration: 1.5,
                separator: ",",
                useEasing: true,
                useGrouping: true
            });

            if (!countUpAnimRef.current.error) {
                countUpAnimRef.current.start();
                previousValueRef.current = value;
            } else {
                console.error(countUpAnimRef.current.error);
                // Fallback to showing the raw number
                if (countupRef.current) {
                    countupRef.current.textContent = new Intl.NumberFormat("en-US").format(value);
                }
            }
        } catch (err) {
            console.error("Failed to load CountUp.js:", err);
            // Fallback to showing the raw number
            if (countupRef.current) {
                countupRef.current.textContent = new Intl.NumberFormat("en-US").format(value);
            }
        }
    }

    return (
        <div
            className={`border-border flex flex-col gap-3 rounded-lg border bg-white p-6 dark:bg-transparent ${className || ""}`}
        >
            <p className="text-muted-foreground text-sm">{title}</p>
            <div className="text-3xl font-semibold">
                {isLoading ? (
                    <div className="h-9 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                ) : error ? (
                    <span className="text-destructive text-base">Error loading data</span>
                ) : (
                    <div ref={countupRef}>0</div>
                )}
            </div>
        </div>
    );
}
