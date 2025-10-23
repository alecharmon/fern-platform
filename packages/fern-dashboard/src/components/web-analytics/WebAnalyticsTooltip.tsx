"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { FC, ReactNode } from "react";

interface WebAnalyticsTooltipProps extends Tooltip.TooltipProps, Omit<Tooltip.TooltipContentProps, "content"> {
    content: ReactNode | undefined;
    container?: HTMLElement | null;
}

/**
 * Standalone tooltip component specifically for web analytics dashboard.
 * Does NOT use any shared fern-docs components to avoid affecting customer sites.
 * Uses dark background (grayscale-1200) with light text (grayscale-100).
 */
export const WebAnalyticsTooltip: FC<WebAnalyticsTooltipProps> = ({
    content,
    children,
    open,
    defaultOpen,
    onOpenChange,
    delayDuration = 0,
    disableHoverableContent,
    container,
    ...props
}) => {
    if (content == null || content === "") {
        return <>{children}</>;
    }
    return (
        <Tooltip.Root
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            delayDuration={delayDuration}
            disableHoverableContent={disableHoverableContent}
        >
            <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
            <Tooltip.Portal container={container}>
                <Tooltip.Content
                    sideOffset={6}
                    collisionPadding={6}
                    {...props}
                    className="shadow-card-grayscale z-50 max-w-xs rounded-lg border-none bg-[var(--gray-1200)] p-2 text-center text-sm leading-normal text-[var(--gray-100)] will-change-[transform,opacity]"
                >
                    {content}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
};

export const WebAnalyticsTooltipProvider = Tooltip.Provider;
