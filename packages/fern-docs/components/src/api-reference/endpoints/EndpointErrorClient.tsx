"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { X } from "lucide-react";
import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import { AvailabilityBadge, StatusCodeBadge } from "../../badges";
import { cn } from "../../cn";

export function EndpointErrorClient({
    error,
    isFirst,
    isLast,
    isSelected,
    onClick,
    onClose,
    availability,
    children
}: {
    error: ApiDefinition.ErrorResponse;
    isFirst: boolean;
    isLast: boolean;
    isSelected: boolean;
    onClick: MouseEventHandler<HTMLDivElement>;
    onClose?: MouseEventHandler<HTMLButtonElement> | undefined;
    availability: ApiDefinition.Availability | null | undefined;
    children: React.ReactNode;
}) {
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
            }
        },
        [onClick]
    );

    return (
        <div
            role="button"
            tabIndex={0}
            className={cn(
                "space hover:bg-(color:--grayscale-a2) flex cursor-pointer flex-col items-start px-3 py-3 transition-colors",
                { "bg-(color:--grayscale-a2)": isSelected },
                { "border-border-default border-b": !isLast },
                { "rounded-t-[inherit]": isFirst },
                { "rounded-b-[inherit]": isLast }
            )}
            onClick={onClick}
            onKeyDown={handleKeyDown}
        >
            <div className="flex w-full items-center justify-between">
                <div className="flex items-baseline space-x-2">
                    <StatusCodeBadge
                        statusCode={error.statusCode}
                        isWildcard={error.isWildcard ?? undefined}
                        size="sm"
                    />
                    <div className="text-(color:--grayscale-a11) text-left text-xs">{error.name}</div>
                    {availability != null && <AvailabilityBadge availability={availability} size="sm" rounded />}
                </div>
                {onClose != null && (
                    <button
                        className="text-(color:--grayscale-a11) hover:text-(color:--grayscale-a12) rounded-1 hover:bg-(color:--grayscale-a3) flex items-center justify-center p-0.5 transition-colors"
                        onClick={onClose}
                        aria-label="Collapse error"
                        type="button"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>

            {children}
        </div>
    );
}
