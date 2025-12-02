"use client";

import type { SerializableFoundNode } from "@fern-docs/components/navigation";
import { forwardRef, useCallback, useImperativeHandle, useState } from "react";

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

export interface CreatePageButtonHandle {
    /** Opens the create page popover with an optional default section */
    openWithSection: (sectionId?: string) => void;
}

export const CreatePageButton = forwardRef<CreatePageButtonHandle, CreatePageButtonProps>(({ baseFoundNode }, ref) => {
    const { prStatus } = useGitPrInfo();
    const isEditingDisabled = useEditingDisabled();
    const [isOpen, setIsOpen] = useState(false);
    const [sectionId, setSectionId] = useState<string | undefined>(undefined);

    const handleOpenWithSection = useCallback((newSectionId?: string) => {
        setSectionId(newSectionId);
        setIsOpen(true);
    }, []);

    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // Clear section ID when closing
            setSectionId(undefined);
        }
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            openWithSection: handleOpenWithSection
        }),
        [handleOpenWithSection]
    );

    const tooltipContent =
        isEditingDisabled && prStatus === "merged"
            ? "Cannot create page - PR has already been merged"
            : isEditingDisabled && prStatus === "closed"
              ? "Cannot create page - PR has been closed"
              : undefined;

    return (
        <DashboardTooltip content={tooltipContent}>
            <CreateClientPage
                baseFoundNode={baseFoundNode}
                disabled={isEditingDisabled}
                open={isOpen || undefined}
                onOpenChange={isOpen ? handleOpenChange : undefined}
                defaultSectionId={sectionId}
                modal={isOpen}
            >
                <Button
                    className="mb-2 flex w-full items-center justify-center gap-2 self-stretch rounded-lg border border-dashed border-[var(--grayscale-a6)] p-2 text-sm text-[var(--grayscale-a11)] hover:bg-[var(--grayscale-a3)] hover:text-[var(--grayscale-a12)]"
                    variant="ghost"
                >
                    <Icon variant="Plus" /> Create new page
                </Button>
            </CreateClientPage>
        </DashboardTooltip>
    );
});

CreatePageButton.displayName = "CreatePageButton";
