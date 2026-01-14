"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { Chip } from "@fern-docs/components/Chip";
import { useMemo } from "react";

import { DescriptionEditButton } from "@/components/editor/DescriptionEditButton";
import { MouseFollowingTooltip } from "@/components/editor/MouseFollowingTooltip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";
import { useApiEditTarget } from "@/providers/ApiEditTargetContext";
import { type DescriptionTarget, useDescriptionEditability, useLiveDescription } from "@/providers/OpenApiSpecsContext";

export function EnumValue({ enumValue, lang = "en" }: { enumValue: ApiDefinition.EnumValue; lang?: string }) {
    const apiEditTarget = useApiEditTarget();

    // Build enum value description target
    const enumTarget = useMemo((): DescriptionTarget | null => {
        if (!apiEditTarget) {
            return null;
        }

        // For schema types, return enum value target
        if (apiEditTarget.type === "schema") {
            return {
                type: "enumValue",
                typeId: apiEditTarget.typeId,
                enumValue: enumValue.value
            };
        }

        // WebSocket targets return a websocket target to show edit-disabled indicator
        if (apiEditTarget.type === "websocket") {
            return {
                type: "websocket",
                path: apiEditTarget.path
            };
        }

        // Webhook targets return a webhook target to show edit-disabled indicator
        if (apiEditTarget.type === "webhook") {
            return {
                type: "webhook",
                webhookId: apiEditTarget.webhookId
            };
        }

        // gRPC targets return a grpc target to show edit-disabled indicator
        if (apiEditTarget.type === "grpc") {
            return {
                type: "grpc",
                methodId: apiEditTarget.methodId
            };
        }

        // For endpoints, we still need to create an enumValue target
        // but we don't have enough context here (no typeId)
        // So for now, endpoint enum values won't have edit support
        return null;
    }, [apiEditTarget, enumValue.value]);

    const { isEditable, reason } = useDescriptionEditability(enumTarget);
    const liveDescription = useLiveDescription(enumTarget, enumValue.description);

    // No target means we can't show edit UI
    if (!enumTarget) {
        const fallbackContent = liveDescription ? <MdxContent mdx={liveDescription} size="xs" /> : undefined;
        return <Chip name={enumValue.value} description={fallbackContent} lang={lang} />;
    }

    const descriptionContent = liveDescription ? (
        // Has description: editable gets edit button, non-editable gets mouse-following tooltip
        isEditable ? (
            <div className="group/desc relative inline pr-5">
                <MdxContent mdx={liveDescription} size="xs" />
                <span className="absolute -right-1 top-1/2 -translate-y-1/2 inline-flex opacity-0 transition-opacity group-hover/desc:opacity-100">
                    <DescriptionEditButton target={enumTarget} currentValue={liveDescription ?? ""} />
                </span>
            </div>
        ) : (
            <MouseFollowingTooltip reason={reason}>
                <MdxContent mdx={liveDescription} size="xs" />
            </MouseFollowingTooltip>
        )
    ) : // No description: show add button on hover (only if editable)
    isEditable ? (
        <span className="inline-flex opacity-0 transition-opacity group-hover:opacity-100">
            <DescriptionEditButton target={enumTarget} currentValue="" />
        </span>
    ) : null;

    return <Chip name={enumValue.value} description={descriptionContent} lang={lang} />;
}
