"use client";

import { getAllSectionsFromSidebarRootNode, type SerializableFoundNode } from "@fern-docs/components/navigation";

import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { Icon } from "@/components/icon/Icon";
import { Button } from "@/components/ui/button";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useGitPrInfo } from "@/providers/GitPRContext";

import { CreateClientPage } from "./CreateClientPage";

interface CreatePageButtonProps {
    /** The base found node to create the page from */
    baseFoundNode: SerializableFoundNode;
}

export function CreatePageButton({ baseFoundNode }: CreatePageButtonProps) {
    const { prStatus } = useGitPrInfo();
    const isEditingDisabled = useEditingDisabled();

    // Check if there are sections available for creating pages
    const allSections = baseFoundNode.sidebar ? getAllSectionsFromSidebarRootNode(baseFoundNode.sidebar) : [];

    return (
        allSections.length > 0 && (
            <DashboardTooltip
                content={
                    isEditingDisabled && prStatus === "merged"
                        ? "Cannot create page - PR has already been merged"
                        : isEditingDisabled && prStatus === "closed"
                          ? "Cannot create page - PR has been closed"
                          : undefined
                }
            >
                <CreateClientPage baseFoundNode={baseFoundNode} disabled={isEditingDisabled}>
                    <Button
                        className="mb-2 flex w-full items-center justify-center gap-2 self-stretch rounded-lg border border-dashed border-[var(--grayscale-a6)] p-2 text-sm text-[var(--grayscale-a11)] hover:bg-[var(--grayscale-a3)] hover:text-[var(--grayscale-a12)]"
                        variant="ghost"
                    >
                        <Icon variant="Plus" /> Create new page
                    </Button>
                </CreateClientPage>
            </DashboardTooltip>
        )
    );
}
