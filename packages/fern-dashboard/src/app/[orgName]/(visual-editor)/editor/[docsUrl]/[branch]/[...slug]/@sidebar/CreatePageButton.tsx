"use client";

import type { SerializableFoundNode } from "@fern-docs/components/navigation";
import { useNavigation } from "@fern-docs/components/navigation";

import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { Icon } from "@/components/icon/Icon";
import { Button } from "@/components/ui/button";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { UI_MESSAGES } from "@/utils/messages";

import { CreateClientPage } from "./CreateClientPage";

interface CreatePageButtonProps {
    /** The base found node to create the page from */
    baseFoundNode: SerializableFoundNode;
}

export function CreatePageButton({ baseFoundNode }: CreatePageButtonProps) {
    const { prStatus } = useGitPrInfo();
    const isEditingDisabled = useEditingDisabled();
    const navigation = useNavigation();

    // LIMITATION: Page creation is not supported for multi-product or multi-version docs
    // These docs have separate docs.yml files for each product/version, and we would need to
    // determine which specific file to modify. This is a complex operation that's not yet supported.
    const canEditNavigation = navigation.canDirectlyEditDocsYmlNavigation;

    const tooltipContent = !canEditNavigation
        ? UI_MESSAGES.NAVIGATION_EDITS_NOT_SUPPORTED_MULTI_DOCS_YML
        : isEditingDisabled && prStatus === "merged"
          ? "Cannot create page - PR has already been merged"
          : isEditingDisabled && prStatus === "closed"
            ? "Cannot create page - PR has been closed"
            : undefined;

    return (
        <DashboardTooltip content={tooltipContent}>
            <CreateClientPage baseFoundNode={baseFoundNode} disabled={isEditingDisabled || !canEditNavigation}>
                <Button
                    className="mb-2 flex w-full items-center justify-center gap-2 self-stretch rounded-lg border border-dashed border-[var(--grayscale-a6)] p-2 text-sm text-[var(--grayscale-a11)] hover:bg-[var(--grayscale-a3)] hover:text-[var(--grayscale-a12)]"
                    variant="ghost"
                >
                    <Icon variant="Plus" /> Create new page
                </Button>
            </CreateClientPage>
        </DashboardTooltip>
    );
}
