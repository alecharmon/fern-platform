import React from "react";

import { cn } from "@/utils/utils";

export function AnalyticsHistogramSkeleton({ className }: { className?: string }) {
    // Roughly mimic a histogram: grid lines + bars with varying heights
    const barHeights = [20, 38, 26, 54, 72, 44, 32, 58, 84, 64, 48, 36];

    return (
        <div className={cn("relative h-[412px] w-full overflow-hidden", className)}>
            {/* Bars */}
            <div className="absolute inset-x-0 bottom-12 top-4 px-6">
                <div className="flex h-full w-full items-end gap-4">
                    {barHeights.map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 animate-pulse rounded-md bg-gray-400"
                            style={{ height: `${Math.max(8, h)}%` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AnalyticsHistogramSkeleton;
