"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { useDevMode } from "@/providers/DevModeProvider";
import { useOpenApiSpecs } from "@/providers/OpenApiSpecsContext";

const FORMAT_LABELS: Record<string, string> = {
    asyncapi: "AsyncAPI",
    proto: "gRPC/Protocol Buffers",
    "fern-definition": "Fern Definition"
};

export function UnsupportedApiFormatNotification() {
    const { currentPageType } = useDevMode();
    const { sourceType } = useOpenApiSpecs();

    const notificationText = useMemo(() => {
        if (!sourceType || sourceType === "openapi" || sourceType === "unknown") {
            return null;
        }
        const formatLabel = FORMAT_LABELS[sourceType] || sourceType;
        return `Dev Mode does not yet support ${formatLabel} specs`;
    }, [sourceType]);

    // Only show on API reference pages with unsupported formats
    if (currentPageType !== "api-reference" || !notificationText) {
        return null;
    }

    return (
        <div className="text-gray-1100 absolute left-[calc(50%-175px)] top-[calc(var(--header-toolbar-height)+var(--header-height)+12px)] z-50 flex w-[350px] justify-center">
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-amber-500 bg-amber-50 px-3 py-1.5">
                <AlertTriangle className="size-4 text-amber-600" />
                <div className="text-sm text-amber-800">{notificationText}</div>
            </div>
        </div>
    );
}
