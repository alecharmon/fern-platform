"use client";

import type { ComponentProps, ReactNode } from "react";

import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

export function DashboardTooltip({
    children,
    content,
    delayDuration = 0,
    hideInnerSpan = false,
    ...props
}: {
    children: ReactNode;
    hideInnerSpan?: boolean;
} & ComponentProps<typeof Tooltip>) {
    return (
        <TooltipProvider>
            <Tooltip content={content} delayDuration={delayDuration} {...props}>
                {/* Additional span ensures disabled children still have pointer events */}
                {hideInnerSpan ? children : <span className="pointer-events-auto">{children}</span>}
            </Tooltip>
        </TooltipProvider>
    );
}
