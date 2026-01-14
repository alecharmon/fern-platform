"use client";

/**
 * Unsupported API Format Notification
 *
 * Page-level notification shown when the current API reference page
 * uses a format that is not yet fully supported in the Editor.
 */

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";

import { useDevMode } from "@/providers/DevModeProvider";
import { useOpenApiSpecs } from "@/providers/OpenApiSpecsContext";
import { cn } from "@/utils/utils";

const FORMAT_LABELS: Record<string, string> = {
    asyncapi: "AsyncAPI",
    openrpc: "OpenRPC",
    proto: "gRPC/Protocol Buffers",
    "fern-definition": "Fern Definition"
};

const FORMAT_DETAILS: Record<string, string> = {
    asyncapi: "AsyncAPI specifications are viewable but descriptions cannot be edited yet",
    openrpc: "OpenRPC specifications are viewable but descriptions cannot be edited yet",
    proto: "gRPC/Protocol Buffer definitions are not yet supported in the Editor",
    "fern-definition": "Fern Definition files are not yet supported in the Editor"
};

export interface UnsupportedApiFormatNotificationProps {
    /** Additional class names */
    className?: string;
}

export function UnsupportedApiFormatNotification({ className }: UnsupportedApiFormatNotificationProps) {
    const { currentPageType } = useDevMode();
    const { sourceType, specs } = useOpenApiSpecs();

    const notification = useMemo(() => {
        // Only show for non-OpenAPI formats
        if (!sourceType || sourceType === "openapi" || sourceType === "unknown") {
            return null;
        }

        const formatLabel = FORMAT_LABELS[sourceType] || sourceType;
        const details = FORMAT_DETAILS[sourceType];

        // Main message about editing
        const mainText = `APIs defined in ${formatLabel} are not yet editable in the Editor`;

        return { mainText, details, hasSpecs: specs && specs.size > 0 };
    }, [sourceType, specs]);

    // Only show on API reference pages with unsupported formats
    if (currentPageType !== "api-reference" || !notification) {
        return null;
    }

    return (
        <div
            className={cn(
                "absolute left-1/2 z-50 -translate-x-1/2",
                "top-[calc(var(--header-toolbar-height)+var(--header-height)+12px)]",
                className
            )}
        >
            <div
                className={cn(
                    "flex max-w-md flex-col items-center gap-1 rounded-lg border px-4 py-2 shadow-sm",
                    "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50"
                )}
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {notification.mainText}
                    </span>
                </div>
                {notification.details && (
                    <span className="text-center text-xs text-amber-700 dark:text-amber-400">
                        {notification.details}
                    </span>
                )}
            </div>
        </div>
    );
}
