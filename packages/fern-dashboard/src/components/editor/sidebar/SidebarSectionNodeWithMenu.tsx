"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useNavigation } from "@fern-docs/components/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { File, GripVertical, MoreVertical, Pencil } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [buttonTop, setButtonTop] = useState<number | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when title or isHovered changes
    useLayoutEffect(() => {
        if (containerRef.current) {
            const expandIndicator = containerRef.current.querySelector(".expand-indicator");
            if (expandIndicator) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const indicatorRect = expandIndicator.getBoundingClientRect();
                const relativeTop = indicatorRect.top - containerRect.top + indicatorRect.height / 2;
                setButtonTop(relativeTop);
            }
        }
    }, [node.title, isHovered]);

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
            <div
                ref={containerRef}
                className="group sidebar-section-node-with-menu relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {children}

                {/* Drag handle — positioned to the left of the heading.
                    Uses group-hover so it stays visible when the cursor moves from
                    the heading to the handle (both are inside the same group). */}
                {!isEditingDisabled && (
                    <div
                        className="absolute left-0 top-1/2 z-10 -translate-x-full -translate-y-1/2 cursor-grab rounded-md px-0.5 py-1 opacity-0 transition-opacity duration-150 hover:bg-gray-500/40 group-hover:opacity-100 active:cursor-grabbing"
                        aria-label="Drag to reorder"
                    >
                        <GripVertical className="size-3.5 text-muted-foreground" />
                    </div>
                )}

                <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <DropdownMenu.Trigger asChild>
                        <button
                            className="absolute right-[5px] -translate-y-1/2 cursor-pointer rounded-md p-1 text-gray-1000 opacity-0 transition-opacity duration-200 hover:bg-gray-300 group-hover:opacity-100 data-[state=open]:opacity-100 disabled:cursor-default disabled:group-hover:opacity-50 disabled:hover:bg-transparent"
                            style={{ top: buttonTop != null ? `${buttonTop}px` : "50%" }}
                            title="Section options"
                            aria-label="Section options"
                            disabled={isEditingDisabled}
                            // Stop propagation so that clicking the "..." button doesn't
                            // also toggle the Collapsible.Trigger (which wraps this
                            // component when used inside SidebarCollapseGroup).
                            onClick={(e) => e.stopPropagation()}
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
