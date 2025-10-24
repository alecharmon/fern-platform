"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useNavigation } from "@fern-docs/components/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { UI_MESSAGES } from "@/utils/messages";
import { DashboardTooltip } from "./DashboardTooltip";
import { RenameSectionDialog } from "./RenameSectionDialog";

export interface SidebarSectionWithMenuProps {
    node: FernNavigation.SectionNode;
    trigger: ReactNode;
}

export function SidebarSectionWithMenu({ node, trigger }: SidebarSectionWithMenuProps): ReactNode {
    const navigation = useNavigation();
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [_showDeleteDialog, _setShowDeleteDialog] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // LIMITATION: Section renaming is not supported for multi-product or multi-version docs
    // These docs have separate docs.yml files for each product/version, and we would need to
    // determine which specific file to modify. This is a complex operation that's not yet supported.
    const isRenameDisabled = !navigation.canDirectlyEditDocsYmlNavigation;
    const renameDisabledTooltip = isRenameDisabled
        ? UI_MESSAGES.NAVIGATION_EDITS_NOT_SUPPORTED_MULTI_DOCS_YML
        : undefined;

    const handleRenameConfirm = (newTitle: string) => {
        try {
            navigation.renameSection(node.id, newTitle);
            setShowRenameDialog(false);
            setDropdownOpen(false);
        } catch (error) {
            console.error("Failed to rename section:", error);
            alert(error instanceof Error ? error.message : "Failed to rename section");
        }
    };

    return (
        <>
            <div className="group sidebar-section-with-menu relative">
                {trigger}
                <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <DropdownMenu.Trigger asChild>
                        <button
                            className="absolute right-[5px] top-[5px] cursor-pointer rounded-md p-1 text-gray-1000 opacity-0 transition-opacity duration-200 hover:bg-gray-300 group-hover:opacity-100 data-[state=open]:opacity-100"
                            title="Section options"
                            aria-label="Section options"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <MoreVertical className="size-4" />
                        </button>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 w-48 rounded-lg border border-gray-300 bg-white p-1 shadow-lg"
                            side="right"
                            align="start"
                            sideOffset={8}
                        >
                            <DashboardTooltip content={renameDisabledTooltip} side="top">
                                <DropdownMenu.Item
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-gray-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent"
                                    disabled={isRenameDisabled}
                                    onSelect={() => {
                                        if (!isRenameDisabled) {
                                            setShowRenameDialog(true);
                                            setDropdownOpen(false);
                                        }
                                    }}
                                >
                                    <Pencil className="size-4" />
                                    <span>Rename</span>
                                </DropdownMenu.Item>
                            </DashboardTooltip>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </div>

            {/* Render dialogs */}
            <RenameSectionDialog
                open={showRenameDialog}
                onOpenChange={(open) => !open && setShowRenameDialog(false)}
                currentTitle={node.title}
                onConfirm={handleRenameConfirm}
            />
            {/* TODO: Add DeleteSectionDialog */}
        </>
    );
}
