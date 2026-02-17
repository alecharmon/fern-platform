"use client";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getChildren } from "@fern-api/fdr-sdk/navigation";
import { Button } from "@fern-docs/components/FernButtonV2";
import { constructEditorSlug, ROOT_SLUG_ALIAS, useNavigation } from "@fern-docs/components/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Eye, EyeOff, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import type { EncodedDocsUrl } from "@/utils/types";
import { RenameDialog } from "./RenameDialog";

interface SidebarPageNodeWithMenuProps {
    node: FernNavigation.NavigationNodeWithMarkdown;
    children: ReactNode;
}

export function SidebarPageNodeWithMenu({ node, children }: SidebarPageNodeWithMenuProps): ReactNode {
    const params = useParams();
    const router = useRouter();
    const navigation = useNavigation();
    const isEditingDisabled = useEditingDisabled();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const pageEntry = navigation.pageRegistry
        ? Object.values(navigation.pageRegistry).find((entry) => entry.pageData.foundNode.node.id === node.id)
        : undefined;

    const isClientPage = pageEntry?.pageData.source === "client";

    const filename = pageEntry?.pageData.filename || ("pageId" in node ? node.pageId : null);

    const isMarkedForDeletion = pageEntry?.isMarkedForDeletion ?? false;

    const isMarkedForDeletionInDocsYml =
        filename && navigation.navigationChanges
            ? Array.from(navigation.navigationChanges.entries()).some(
                  ([changeFilename, change]) => changeFilename === filename && change.type === "remove_page"
              )
            : false;

    if (isMarkedForDeletion || isMarkedForDeletionInDocsYml) {
        return null;
    }

    const hasNodeChildren = getChildren(node).length > 0;

    const isLandingPage = node.type === "landingPage";

    const isSectionOverview = FernNavigation.isSectionOverview(node);

    const showMenu = !hasNodeChildren && !isLandingPage && !isSectionOverview;

    const handlePageClick = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        if (!params) {
            return;
        }

        const { orgName, docsUrl, branch } = params as {
            orgName: string;
            docsUrl: string;
            branch: string;
        };
        const fullSlug = node.slug;

        router.push(`/${orgName}/editor/${docsUrl}/${branch}/${fullSlug}`);
    };

    const handleConfirmedDelete = () => {
        if (!params || !filename) {
            console.error("[SidebarPageNodeWithMenu] Cannot delete page: no filename available");
            return;
        }

        const pageTitle = pageEntry?.pageData.foundNode.node.title || node.title;

        navigation.markPageForDeletion(filename, pageTitle);

        let redirectTarget = ROOT_SLUG_ALIAS;

        if (pageEntry?.pageData.foundNode) {
            const foundNode = pageEntry.pageData.foundNode;
            if (foundNode.currentTab && "slug" in foundNode.currentTab) {
                redirectTarget = foundNode.currentTab.slug;
            } else if (foundNode.currentProduct && FernNavigation.isInternalProductNode(foundNode.currentProduct)) {
                redirectTarget = foundNode.currentProduct.slug;
            } else if (foundNode.parents.length > 0) {
                const immediateParent = foundNode.parents[foundNode.parents.length - 1];
                if (immediateParent && "slug" in immediateParent) {
                    redirectTarget = immediateParent.slug;
                }
            }
        } else {
            const currentSlug = params.slug;
            if (Array.isArray(currentSlug) && currentSlug.length > 0) {
                redirectTarget = currentSlug[0] ?? ROOT_SLUG_ALIAS;
            }
        }

        const redirectUrl = constructEditorSlug({
            orgName: String(params.orgName) as Auth0OrgName,
            docsUrl: String(params.docsUrl) as EncodedDocsUrl,
            branchName: String(params.branch),
            slug: redirectTarget
        });
        setTimeout(() => router.push(redirectUrl), 0);
        setShowDeleteConfirm(false);
    };

    const handleRenameConfirm = (newTitle: string) => {
        if (!("pageId" in node)) {
            console.error("[SidebarPageNodeWithMenu] Cannot rename: node has no pageId");
            return;
        }

        try {
            navigation.renamePage(node.pageId, newTitle);
            setShowRenameDialog(false);
        } catch (error) {
            console.error("Failed to rename page:", error);
            alert(error instanceof Error ? error.message : "Failed to rename page");
        }
    };

    const renderPageMenu = () => {
        return (
            <>
                <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <DropdownMenu.Trigger asChild>
                        <button
                            className="absolute inset-y-0 right-2 flex cursor-pointer items-center text-gray-1000 opacity-0 transition-opacity duration-200 group-hover/page-menu:opacity-100 data-[state=open]:opacity-100 disabled:cursor-default disabled:group-hover/page-menu:opacity-50"
                            title="Page options"
                            aria-label="Page options"
                            disabled={isEditingDisabled}
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
                                onSelect={() => {
                                    if ("pageId" in node) {
                                        navigation.togglePageHidden(node.id, node.pageId, !node.hidden);
                                    }
                                    setDropdownOpen(false);
                                }}
                            >
                                {node.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                                <span>{node.hidden ? "Show" : "Hide"}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent"
                                onSelect={(e) => {
                                    e.preventDefault();
                                    setDropdownOpen(false);
                                    setTimeout(() => {
                                        setShowDeleteConfirm(true);
                                    }, 0);
                                }}
                            >
                                <Trash2 className="size-4" />
                                <span>Delete</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <Popover.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <Popover.Anchor className="absolute inset-y-0 right-2 flex items-center" />
                    <Popover.Portal>
                        <Popover.Content
                            className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-56 rounded-lg border border-gray-500 bg-white p-3 shadow-lg"
                            side="right"
                            align="center"
                            sideOffset={8}
                            onFocusOutside={(e) => e.preventDefault()}
                        >
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col text-sm font-semibold">Delete this page?</div>

                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="border-gray-500 p-2 text-xs text-foreground cursor-pointer hover:bg-gray-300"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleConfirmedDelete}
                                        className="p-2 text-xs text-white cursor-pointer"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </>
        );
    };

    return (
        <>
            <div className="group/page-menu relative" onClick={isClientPage ? handlePageClick : undefined}>
                {children}
                {showMenu && renderPageMenu()}
            </div>

            <RenameDialog
                open={showRenameDialog}
                onOpenChange={(open) => !open && setShowRenameDialog(false)}
                currentTitle={node.title}
                onConfirm={handleRenameConfirm}
                entityType="page"
            />
        </>
    );
}
