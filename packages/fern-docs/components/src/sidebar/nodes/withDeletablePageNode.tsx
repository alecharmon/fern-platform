"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import * as Popover from "@radix-ui/react-popover";
import { MinusCircleIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

import { Button } from "../../FernButtonV2";
import { useScrollSidebarNodeIntoView } from "../../hooks/sidebar-scroll";
import { constructEditorSlug, ROOT_SLUG_ALIAS, useMaybeNavigation } from "../../navigation";
import type { Auth0OrgNameIsh, EncodedDocsUrlIsh } from "../../navigation/routingUtils";
import { useIsSelectedSidebarNode } from "../../state/navigation";
import { SidebarLink } from "../SidebarLink";

export interface WithDeletablePageNodeProps {
    node: FernNavigation.NavigationNodeWithMarkdown;
    icon: React.ReactNode;
    depth: number;
    className?: string;
    shallow?: boolean;
}

export function withDeletablePageNode<P extends WithDeletablePageNodeProps>(WrappedComponent: React.ComponentType<P>) {
    return function WithDeletablePageNode(props: P): ReactNode {
        const { node } = props;
        const ref = useRef<HTMLAnchorElement>(null);
        const params = useParams();
        const router = useRouter();
        const navigation = useMaybeNavigation();
        const selected = useIsSelectedSidebarNode(node.id);
        const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

        // Get page entry from registry to determine if it's a client page
        const pageEntry = navigation?.pageRegistry
            ? Object.values(navigation.pageRegistry).find((entry) => entry.pageData.foundNode.node.id === node.id)
            : undefined;

        const isClientPage = pageEntry?.pageData.source === "client";

        // Get filename for this page (used for deletion tracking)
        const filename = pageEntry?.pageData.filename || ("pageId" in node ? node.pageId : null);

        useScrollSidebarNodeIntoView(ref, node.id);

        // If navigation is not available (not in client-render sidebar env), render the wrapped component as-is
        if (!navigation) {
            return <WrappedComponent {...props} />;
        }

        // Check if page is marked for deletion either in registry or in docsYmlChanges
        const isMarkedForDeletion = pageEntry?.isMarkedForDeletion ?? false;

        // For server pages not in registry, check docsYmlChanges
        const isMarkedForDeletionInDocsYml =
            filename && navigation.docsYmlChanges
                ? Array.from(navigation.docsYmlChanges.entries()).some(
                      ([changeFilename, change]) => changeFilename === filename && change.type === "remove_page"
                  )
                : false;

        // If page is marked for deletion, don't render it at all
        if (isMarkedForDeletion || isMarkedForDeletionInDocsYml) {
            return null;
        }

        const handleClientPageClick = (e: React.MouseEvent<HTMLElement>) => {
            e.preventDefault();
            if (!params || !pageEntry) return;

            const { orgName, docsUrl, branch } = params as {
                orgName: string;
                docsUrl: string;
                branch: string;
            };
            const fullSlug = node.slug;

            router.push(`/${orgName}/editor/${docsUrl}/${branch}/${fullSlug}?client-page=true`);
        };

        const handleConfirmedDelete = () => {
            if (!params || !filename) {
                console.error("Cannot delete page: no filename available");
                return;
            }

            // For server pages not in registry, pass the title from the node
            const pageTitle = pageEntry?.pageData.foundNode.node.title || node.title;

            navigation.markPageForDeletion(filename, pageTitle);

            // Build redirect URL preserving current navigation context
            let redirectTarget = ROOT_SLUG_ALIAS;

            // Try to get current tab from page entry (for client pages / visited server pages)
            if (pageEntry?.pageData.foundNode) {
                const foundNode = pageEntry.pageData.foundNode;
                if (foundNode.currentTab && "slug" in foundNode.currentTab) {
                    redirectTarget = foundNode.currentTab.slug;
                } else if (foundNode.currentProduct) {
                    redirectTarget = foundNode.currentProduct.slug;
                } else if (foundNode.parents.length > 0) {
                    // Go to the immediate parent section/group
                    const immediateParent = foundNode.parents[foundNode.parents.length - 1];
                    if (immediateParent && "slug" in immediateParent) {
                        redirectTarget = immediateParent.slug;
                    }
                }
            } else {
                // For server pages not in registry, try to extract tab from current URL
                const currentSlug = params.slug;
                if (Array.isArray(currentSlug) && currentSlug.length > 0) {
                    // The first segment of the slug is typically the tab
                    redirectTarget = currentSlug[0] ?? ROOT_SLUG_ALIAS;
                }
            }

            const redirectUrl = constructEditorSlug({
                orgName: String(params.orgName) as Auth0OrgNameIsh,
                docsUrl: encodeURIComponent(String(params.docsUrl)) as EncodedDocsUrlIsh,
                branchName: String(params.branch),
                slug: redirectTarget
            });
            setTimeout(() => router.push(redirectUrl), 0);
            setShowDeleteConfirm(false);
        };

        // Render delete confirmation popover
        const renderDeleteConfirmation = () => {
            return (
                <Popover.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <Popover.Trigger asChild>
                        <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-red-600 opacity-0 transition-opacity duration-200 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100 data-[state=open]:opacity-100 dark:text-red-400 dark:hover:bg-red-950/20 dark:hover:text-red-300"
                            title="Mark for deletion"
                            aria-label="Mark for deletion"
                        >
                            <MinusCircleIcon className="size-4" />
                        </button>
                    </Popover.Trigger>

                    <Popover.Portal>
                        <Popover.Content
                            className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 w-56 rounded-lg border border-gray-500 bg-white p-3 shadow-lg"
                            side="right"
                            align="center"
                            sideOffset={8}
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
            );
        };

        // If it's a client page, we need to override the wrapped component's behavior
        if (isClientPage) {
            return (
                <div className="group relative">
                    <SidebarLink
                        ref={ref}
                        icon={props.icon}
                        nodeId={node.id}
                        className={props.className}
                        depth={Math.max(props.depth - 1, 0)}
                        title={node.title}
                        hidden={node.hidden}
                        authed={node.authed}
                        onClick={handleClientPageClick}
                        shallow={true}
                        scroll={false}
                        selected={selected}
                    />
                    {renderDeleteConfirmation()}
                </div>
            );
        }

        // For server pages, wrap the original component with deletion functionality
        return (
            <div className="group relative">
                <WrappedComponent {...props} />
                {renderDeleteConfirmation()}
            </div>
        );
    };
}
