"use client";

import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";

export function DashboardTooltip({
    children,
    content,
    delayDuration = 0,
    hideInnerSpan = false
}: {
    children: React.ReactNode;
    hideInnerSpan?: boolean;
} & React.ComponentProps<typeof FernTooltip>) {
    return (
        <FernTooltipProvider>
            <FernTooltip content={content} delayDuration={delayDuration} variant="dashboard">
                {/* Additional span ensures disabled children still have pointer events */}
                {hideInnerSpan ? children : <span className="pointer-events-auto">{children}</span>}
            </FernTooltip>
        </FernTooltipProvider>
    );
}
