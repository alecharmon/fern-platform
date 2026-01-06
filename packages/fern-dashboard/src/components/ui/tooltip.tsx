"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

interface TooltipProps extends TooltipPrimitive.TooltipProps {
    content: ReactNode | undefined;
    children: ReactNode;
    side?: TooltipPrimitive.TooltipContentProps["side"];
    sideOffset?: number;
    className?: string;
}

export function Tooltip({
    content,
    children,
    open,
    defaultOpen,
    onOpenChange,
    delayDuration = 0,
    side,
    sideOffset = 6,
    className
}: TooltipProps) {
    if (content == null || content === "") {
        return <>{children}</>;
    }

    return (
        <TooltipPrimitive.Root
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            delayDuration={delayDuration}
        >
            <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                    side={side}
                    sideOffset={sideOffset}
                    collisionPadding={6}
                    className={cn(
                        "z-50 max-w-xs rounded-lg border-none bg-[#252529] p-2 text-center text-sm text-[#ffffff] shadow-lg",
                        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                        className
                    )}
                >
                    {content}
                    <TooltipPrimitive.Arrow className="fill-[#252529]" />
                </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
    );
}

export const TooltipProvider = TooltipPrimitive.Provider;
