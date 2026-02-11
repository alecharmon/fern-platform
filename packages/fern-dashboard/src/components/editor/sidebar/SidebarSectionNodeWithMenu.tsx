"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useNavigation } from "@fern-docs/components/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { File, GripVertical, MoreVertical, Pencil } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useState } from "react";
import type { CreatePageButtonHandle } from "@/app/[orgName]/(visual-editor)/editor/[docsUrl]/[branch]/[...slug]/@sidebar/CreatePageButton";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { RenameDialog } from "./RenameDialog";

export interface SidebarSectionNodeWithMenuProps {
    node: FernNavigation.SectionNode;
    children: ReactNode;
    /** Ref to the CreatePageButton to trigger its popover */
    createPageButtonRef: RefObject<CreatePageButtonHandle | null>;
}

export function SidebarSectionNodeWithMenu({
    node,
    children,
    createPageButtonRef
}: SidebarSectionNodeWithMenuProps): ReactNode {
    const navigation = useNavigation();
    const isEditingDisabled = useEditingDisabled();
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [_showDeleteDialog, _setShowDeleteDialog] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

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
            <div className="group sidebar-section-node-with-menu relative">
                {children}

                {/* Drag handle — positioned to the left of the heading.
                    Uses inset-y-0 + flex items-center so it vertically centers regardless of
                    customer CSS on the sidebar link. group-hover keeps it visible when the
                    cursor moves from the heading to the handle. */}
                {!isEditingDisabled && (
                    <div
                        className="absolute inset-y-0 -left-1 z-10 flex -translate-x-full items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        aria-label="Drag to reorder"
                    >
                        <div className="cursor-grab rounded-md px-0.5 py-1 hover:bg-gray-500/40 active:cursor-grabbing">
                            <GripVertical className="size-3.5 text-muted-foreground" />
                        </div>
                    </div>
                )}

                <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <DropdownMenu.Trigger asChild>
                        <button
                            className="absolute inset-y-0 right-[5px] flex cursor-pointer items-center text-gray-1000 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[state=open]:opacity-100 disabled:cursor-default disabled:group-hover:opacity-50"
                            title="Section options"
                            aria-label="Section options"
                            disabled={isEditingDisabled}
                            // Stop propagation so that clicking the "..." button doesn't
                            // also toggle the Collapsible.Trigger (which wraps this
                            // component when used inside SidebarCollapseGroup).
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="rounded-md p-1 hover:bg-gray-300">
                                <MoreVertical className="size-4" />
                            </div>
                        </button>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 w-48 rounded-lg border border-gray-300 bg-white p-1 shadow-lg"
                            side="right"
                            align="start"
                            sideOffset={8}
                        >
                            <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-gray-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent"
                                onSelect={() => {
                                    setShowRenameDialog(true);
                                    setDropdownOpen(false);
                                }}
                            >
                                <Pencil className="size-4" />
                                <span>Rename</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-gray-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent"
                                onSelect={(e) => {
                                    // Prevent default to control the dismissal
                                    e.preventDefault();
                                    setDropdownOpen(false);
                                    // Wait for the dropdown to close before opening the popover
                                    // to avoid UI conflicts between the two overlays
                                    setTimeout(() => {
                                        createPageButtonRef.current?.openWithSection(node.id);
                                    }, 0);
                                }}
                            >
                                <File className="size-4" />
                                <span>Add page</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </div>

            {/* Render dialogs */}
            <RenameDialog
                open={showRenameDialog}
                onOpenChange={(open) => !open && setShowRenameDialog(false)}
                currentTitle={node.title}
                onConfirm={handleRenameConfirm}
            />
        </>
    );
}
