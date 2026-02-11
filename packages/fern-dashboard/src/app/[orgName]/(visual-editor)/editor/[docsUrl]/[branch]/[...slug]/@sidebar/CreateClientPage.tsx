"use client";

import { useRouter } from "@bprogress/next/app";
import {
    constructEditorSlug,
    createMdxFrontmatter,
    extractLiveSidebarFromRootNode,
    getAllPageContainersFromSidebarRootNode,
    getClientPageDefaultFilename,
    type PageContainerWithTraversalContext,
    type SerializableFoundNode,
    useNavigation
} from "@fern-docs/components/navigation";
import { useParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pageTitleToSlug } from "@/utils/pageTitleToSlug";
import type { EncodedDocsUrl } from "@/utils/types";

interface CreateClientPageProps {
    children: React.ReactNode;
    disabled?: boolean;
    /** The base found node to create the page from */
    baseFoundNode: SerializableFoundNode;
    /** Optional section ID to pre-select when the dialog opens */
    defaultSectionId?: string;
    /** Optional controlled open state */
    open?: boolean;
    /** Optional callback when open state changes (for controlled mode) */
    onOpenChange?: (open: boolean) => void;
    /** Whether to use modal mode (blocks interaction outside popover) */
    modal?: boolean;
}

export function CreateClientPage({
    children,
    disabled = false,
    baseFoundNode,
    defaultSectionId,
    open: controlledOpen,
    onOpenChange,
    modal = false
}: CreateClientPageProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isPopoverOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsPopoverOpen = useCallback(
        (open: boolean) => {
            if (onOpenChange) {
                onOpenChange(open);
            } else {
                setInternalOpen(open);
            }
        },
        [onOpenChange]
    );
    const [pageTitle, setPageTitle] = useState("");
    const [pageSlug, setPageSlug] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [hasAttemptedSubmission, setHasAttemptedSubmission] = useState(false);
    const [isCreatingNewSection, setIsCreatingNewSection] = useState(false);
    const [newSectionTitle, setNewSectionTitle] = useState("");
    const [parentContainerForNewSection, setParentContainerForNewSection] =
        useState<PageContainerWithTraversalContext | null>(null);
    const router = useRouter();
    const params = useParams();
    const titleInputRef = useRef<HTMLInputElement>(null);

    const navigationSnapshot = useNavigation();
    const { registeredPages, createClientPage, createClientPageInNewSection, rootNode } = navigationSnapshot;

    // Get all available containers (sections + root-level containers) from the navigation tree
    // Use rootNode from NavigationStore instead of baseFoundNode.sidebar to get live updates (e.g., renames)
    const allContainers = useMemo(() => {
        // Try to extract live sidebar from rootNode first
        const liveSidebar = extractLiveSidebarFromRootNode(rootNode, baseFoundNode.currentTab?.slug);
        if (liveSidebar) {
            const containers = getAllPageContainersFromSidebarRootNode(liveSidebar, baseFoundNode.currentTab?.slug);
            return containers;
        }

        // Fallback to baseFoundNode.sidebar (initial server state)
        const containers = baseFoundNode.sidebar
            ? getAllPageContainersFromSidebarRootNode(baseFoundNode.sidebar, baseFoundNode.currentTab?.slug)
            : [];
        return containers;
        // Note: version dependency ensures re-computation when store updates (e.g., section renames).
        // Depending only on rootNode may not trigger re-computation due to React's dependency comparison.
    }, [rootNode, baseFoundNode.sidebar, baseFoundNode.currentTab]);

    // Compute the default container based on current state
    const getDefaultContainer = useCallback(() => {
        if (allContainers.length === 0) {
            return null;
        }
        if (defaultSectionId) {
            const defaultContainer = allContainers.find((c) => c.id === defaultSectionId);
            return defaultContainer ?? allContainers[0] ?? null;
        }
        return allContainers[0] ?? null;
    }, [allContainers, defaultSectionId]);

    // Initialize selected container with the default
    const [selectedContainer, setSelectedContainer] = useState<PageContainerWithTraversalContext | null>(() =>
        getDefaultContainer()
    );

    // Update selected container when popover opens or defaultSectionId changes
    useEffect(() => {
        if (isPopoverOpen) {
            setSelectedContainer(getDefaultContainer());
        }
    }, [isPopoverOpen, getDefaultContainer]);

    // Focus the title input when the popover opens
    useEffect(() => {
        if (isPopoverOpen && titleInputRef.current) {
            // Use setTimeout to ensure the popover animation has completed
            setTimeout(() => {
                titleInputRef.current?.focus();
            }, 0);
        }
    }, [isPopoverOpen]);

    // Auto-generate slug from page title
    // For root-level containers, use only the page title slug without a section prefix
    const autoGeneratedSlug = useMemo(() => {
        if (!pageTitle) {
            return "";
        }
        const pageTitleSlug = pageTitleToSlug(pageTitle);

        if (isCreatingNewSection && newSectionTitle && parentContainerForNewSection) {
            const sectionSlug = pageTitleToSlug(newSectionTitle);
            const parentSlug = parentContainerForNewSection.slug;
            return parentSlug ? `${parentSlug}/${sectionSlug}/${pageTitleSlug}` : `${sectionSlug}/${pageTitleSlug}`;
        }

        // Check if this is a root-level container
        if (selectedContainer && "isRootLevel" in selectedContainer && selectedContainer.isRootLevel) {
            // For root-level pages, use the container slug (tab slug) as the prefix
            return selectedContainer.slug ? `${selectedContainer.slug}/${pageTitleSlug}` : pageTitleSlug;
        }

        // For section pages, use the section slug as prefix
        return selectedContainer?.slug ? `${selectedContainer.slug}/${pageTitleSlug}` : pageTitleSlug;
    }, [pageTitle, selectedContainer, isCreatingNewSection, newSectionTitle, parentContainerForNewSection]);

    // Use custom slug if provided, otherwise use auto-generated
    const finalSlug = pageSlug || autoGeneratedSlug;

    // Field-specific errors for real-time validation
    const errors = useMemo(() => {
        const validatePageTitle = () => {
            if (!pageTitle) {
                return "Page title is required";
            }

            if (pageTitle !== pageTitle.trim()) {
                return "Page title cannot have leading or trailing spaces";
            }

            return null;
        };

        const validateNewSectionTitle = () => {
            if (isCreatingNewSection && !newSectionTitle) {
                return "Section title is required";
            }

            if (isCreatingNewSection && newSectionTitle !== newSectionTitle.trim()) {
                return "Section title cannot have leading or trailing spaces";
            }

            // Check for duplicate sibling section names in the selected parent container
            // Look up the live version from allContainers to reflect any renames (state may be stale)
            if (isCreatingNewSection && newSectionTitle && parentContainerForNewSection) {
                const liveParent =
                    allContainers.find((c) => c.id === parentContainerForNewSection.id) ?? parentContainerForNewSection;
                const children = "children" in liveParent ? liveParent.children : [];
                const hasDuplicateSibling = children?.some(
                    (child) => child.type === "section" && child.title === newSectionTitle
                );
                if (hasDuplicateSibling) {
                    return "A section with this name already exists";
                }
            }

            return null;
        };

        const validateContainer = () => {
            if (isCreatingNewSection) {
                if (!parentContainerForNewSection) {
                    return "Please select where to place the new section";
                }
            } else {
                if (!selectedContainer) {
                    return "Please select a section";
                }
            }
            return null;
        };

        const validateSlug = () => {
            if (!finalSlug) {
                return "Invalid page title - cannot generate slug";
            }

            if (finalSlug !== finalSlug.trim()) {
                return "Slug cannot have leading or trailing spaces";
            }

            // Reject slugs that would create empty path segments or invalid paths
            if (finalSlug.startsWith("/") || finalSlug.endsWith("/") || finalSlug.includes("//")) {
                return "Slug cannot start or end with '/' or contain '//'";
            }

            // Check for invalid path segments (empty, ".", or "..")
            const segments = finalSlug.split("/");
            if (segments.some((s) => s === "." || s === ".." || s.length === 0)) {
                return "Slug contains an invalid path segment";
            }

            if (finalSlug !== pageTitleToSlug(finalSlug)) {
                return "Invalid slug format";
            }

            // Check for duplicates
            const duplicateInRegistry = Object.values(registeredPages).some(
                (page) => page.pageData.frontmatter?.slug === finalSlug
            );

            // Check for duplicates in the selected container
            // Look up the live version from allContainers to reflect any renames (state may be stale)
            const liveSelectedContainer = selectedContainer
                ? (allContainers.find((c) => c.id === selectedContainer.id) ?? selectedContainer)
                : null;
            const duplicateInContainer =
                liveSelectedContainer && "children" in liveSelectedContainer
                    ? liveSelectedContainer.children
                          ?.filter((child) => child.type === "page")
                          .some((page) => "slug" in page && page.slug === finalSlug)
                    : false;

            if (duplicateInRegistry || duplicateInContainer) {
                return "A page with this slug already exists";
            }

            return null;
        };

        return {
            pageTitle: validatePageTitle(),
            newSectionTitle: validateNewSectionTitle(),
            container: validateContainer(),
            slug: validateSlug()
        };
    }, [
        pageTitle,
        newSectionTitle,
        selectedContainer,
        parentContainerForNewSection,
        finalSlug,
        registeredPages,
        isCreatingNewSection,
        allContainers
    ]);

    // Block user submission if mandatory fields are not filled
    const blockSubmission =
        pageTitle.length === 0 ||
        finalSlug.length === 0 ||
        (isCreatingNewSection ? !newSectionTitle || !parentContainerForNewSection : !selectedContainer);

    const resetForm = useCallback(() => {
        setPageTitle("");
        setPageSlug("");
        setIsCreatingNewSection(false);
        setNewSectionTitle("");
        setParentContainerForNewSection(null);
        setHasAttemptedSubmission(false);
    }, []);

    const handleCreatePage = useCallback(async () => {
        setHasAttemptedSubmission(true);

        if (blockSubmission || errors.pageTitle || errors.newSectionTitle || errors.container || errors.slug) {
            return;
        }

        setIsCreating(true);

        try {
            const filename = getClientPageDefaultFilename(finalSlug);

            // Close popover and reset form
            setIsPopoverOpen(false);
            resetForm();

            const orgName = params.orgName as Auth0OrgName;
            const docsUrl = params.docsUrl as EncodedDocsUrl;
            const branch = params.branch as string;

            try {
                if (isCreatingNewSection && parentContainerForNewSection) {
                    createClientPageInNewSection(filename, {
                        source: "client",
                        filename: filename,
                        initialMdx: createMdxFrontmatter({
                            title: pageTitle,
                            slug: finalSlug
                        }),
                        baseFoundNode: baseFoundNode,
                        targetSectionPath: parentContainerForNewSection.sectionPath,
                        newSectionTitle: newSectionTitle,
                        parentContainerId: parentContainerForNewSection.id,
                        parentContainerContext: {
                            ...baseFoundNode,
                            node: baseFoundNode.node
                        }
                    });
                } else if (selectedContainer) {
                    createClientPage(filename, {
                        source: "client",
                        filename: filename,
                        initialMdx: createMdxFrontmatter({
                            title: pageTitle,
                            slug: finalSlug
                        }),
                        baseFoundNode: baseFoundNode,
                        targetSectionPath: selectedContainer.sectionPath
                    });
                }

                // Navigate to the new page
                const targetUrl = constructEditorSlug({
                    orgName,
                    docsUrl,
                    branchName: branch,
                    slug: finalSlug
                });
                router.push(targetUrl);
            } catch (pageCreationError) {
                console.error("Failed to create page in store:", pageCreationError);
                throw new Error(
                    `Failed to create page in navigation: ${
                        pageCreationError instanceof Error ? pageCreationError.message : "Unknown error"
                    }`
                );
            }
        } catch (err) {
            console.error("Failed to create client page:", err);
        } finally {
            setIsCreating(false);
        }
    }, [
        router,
        params,
        baseFoundNode,
        selectedContainer,
        parentContainerForNewSection,
        pageTitle,
        newSectionTitle,
        finalSlug,
        createClientPage,
        createClientPageInNewSection,
        isCreatingNewSection,
        blockSubmission,
        resetForm,
        errors,
        setIsPopoverOpen
    ]);

    const shouldShowPageTitleError = hasAttemptedSubmission && errors.pageTitle;
    const shouldShowNewSectionTitleError = hasAttemptedSubmission && errors.newSectionTitle;
    const shouldShowSlugError = hasAttemptedSubmission && errors.slug;
    const shouldShowContainerError = hasAttemptedSubmission && errors.container;

    // Button is disabled if form is invalid or currently creating
    const isCreateDisabled = blockSubmission || isCreating;

    return (
        <Popover
            modal={modal}
            open={isPopoverOpen && !disabled}
            onOpenChange={(open: boolean) => {
                if (disabled) {
                    return;
                }
                setIsPopoverOpen(open);

                // Reset form when closing
                if (!open) {
                    setPageTitle("");
                    setPageSlug("");
                    setHasAttemptedSubmission(false);
                    setIsCreating(false);
                }
            }}
        >
            <PopoverTrigger asChild disabled={disabled}>
                {children}
            </PopoverTrigger>
            <PopoverContent className="border-border w-80 border p-3" align="start">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-gray-1100 text-xs font-medium">Page title</label>
                        <Input
                            ref={titleInputRef}
                            placeholder="Enter page title..."
                            value={pageTitle}
                            onChange={(e) => {
                                setPageTitle(e.target.value);
                                setHasAttemptedSubmission(false);
                            }}
                            className={`w-full text-sm ${shouldShowPageTitleError ? "border-red-300 focus:border-red-500" : ""}`}
                        />
                        {shouldShowPageTitleError && (
                            <div className="mt-1 text-xs text-red-600">{errors.pageTitle}</div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-gray-1100 text-xs font-medium">
                            Slug <span className="font-normal text-gray-800">(auto-generated, optional)</span>
                        </label>
                        <Input
                            placeholder={autoGeneratedSlug || "auto-generated-from-title"}
                            value={pageSlug}
                            onChange={(e) => {
                                setPageSlug(e.target.value);
                                setHasAttemptedSubmission(false);
                            }}
                            className={`w-full font-mono text-xs placeholder:text-gray-800 ${shouldShowSlugError ? "border-red-300 focus:border-red-500" : ""}`}
                        />
                        {shouldShowSlugError && <div className="mt-1 text-xs text-red-600">{errors.slug}</div>}
                    </div>

                    <div className="space-y-1">
                        <label className="text-gray-1100 text-xs font-medium">In section...</label>
                        {allContainers.length === 0 ? (
                            <div className="rounded-md border border-gray-200 p-2 text-center text-xs text-gray-800">
                                No sections available
                            </div>
                        ) : (
                            <Select
                                value={isCreatingNewSection ? "new-section" : selectedContainer?.id || ""}
                                onValueChange={(value) => {
                                    if (value === "new-section") {
                                        setIsCreatingNewSection(true);
                                        setParentContainerForNewSection(allContainers[0] || null);
                                        setSelectedContainer(null);
                                    } else {
                                        const container = allContainers.find((c) => c.id === value);
                                        if (!container) {
                                            return;
                                        }
                                        setIsCreatingNewSection(false);
                                        setSelectedContainer(container);
                                        setParentContainerForNewSection(null);
                                    }
                                    setHasAttemptedSubmission(false);
                                }}
                            >
                                <SelectTrigger className="h-8 w-full text-sm">
                                    <SelectValue placeholder="Select section..." />
                                </SelectTrigger>
                                <SelectContent className="border-border">
                                    <SelectItem value="new-section">
                                        <div className="flex items-center">
                                            <span className="font-medium">New section...</span>
                                        </div>
                                    </SelectItem>
                                    {allContainers.map((container) => {
                                        // Check if this is a root-level container
                                        const isRootLevel = "isRootLevel" in container && container.isRootLevel;

                                        if (isRootLevel) {
                                            // Display "No section" for root-level containers
                                            return (
                                                <SelectItem key={container.id} value={container.id}>
                                                    <div className="flex items-center">
                                                        <span className="text-muted-foreground">No section</span>
                                                    </div>
                                                </SelectItem>
                                            );
                                        }

                                        // For sections, display the hierarchical path
                                        const sectionAncestors = container.sectionPath.filter(
                                            (ancestor) => ancestor.type === "section"
                                        );
                                        return (
                                            <SelectItem key={container.id} value={container.id}>
                                                <div className="flex items-center">
                                                    {sectionAncestors.length > 0 && (
                                                        <>
                                                            {sectionAncestors.map((ancestor, idx) => {
                                                                const isLast = idx === sectionAncestors.length - 1;
                                                                return (
                                                                    <span
                                                                        key={ancestor.id}
                                                                        className={
                                                                            !isLast
                                                                                ? "text-muted-foreground mr-1"
                                                                                : "mr-1"
                                                                        }
                                                                    >
                                                                        {ancestor.title}
                                                                        {!isLast ? " / " : ""}
                                                                    </span>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        )}
                        {shouldShowContainerError && (
                            <div className="mt-1 text-xs text-red-600">{errors.container}</div>
                        )}
                    </div>

                    {isCreatingNewSection && (
                        <>
                            <div className="space-y-1">
                                <label className="text-gray-1100 text-xs font-medium">Section title</label>
                                <Input
                                    placeholder="Enter section title..."
                                    value={newSectionTitle}
                                    onChange={(e) => {
                                        setNewSectionTitle(e.target.value);
                                        setHasAttemptedSubmission(false);
                                    }}
                                    className={`w-full text-sm ${shouldShowNewSectionTitleError ? "border-red-300 focus:border-red-500" : ""}`}
                                />
                                {shouldShowNewSectionTitleError && (
                                    <div className="mt-1 text-xs text-red-600">{errors.newSectionTitle}</div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-gray-1100 text-xs font-medium">Place under...</label>
                                <Select
                                    value={parentContainerForNewSection?.id || ""}
                                    onValueChange={(value) => {
                                        const container = allContainers.find((c) => c.id === value);
                                        if (!container) {
                                            return;
                                        }
                                        setParentContainerForNewSection(container);
                                        setHasAttemptedSubmission(false);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-full text-sm">
                                        <SelectValue placeholder="Select parent..." />
                                    </SelectTrigger>
                                    <SelectContent className="border-border">
                                        {allContainers.map((container) => {
                                            const isRootLevel = "isRootLevel" in container && container.isRootLevel;

                                            if (isRootLevel) {
                                                return (
                                                    <SelectItem key={container.id} value={container.id}>
                                                        <div className="flex items-center">
                                                            <span className="text-muted-foreground">Root level</span>
                                                        </div>
                                                    </SelectItem>
                                                );
                                            }

                                            const sectionAncestors = container.sectionPath.filter(
                                                (ancestor) => ancestor.type === "section"
                                            );
                                            return (
                                                <SelectItem key={container.id} value={container.id}>
                                                    <div className="flex items-center">
                                                        {sectionAncestors.length > 0 && (
                                                            <>
                                                                {sectionAncestors.map((ancestor, idx) => {
                                                                    const isLast = idx === sectionAncestors.length - 1;
                                                                    return (
                                                                        <span
                                                                            key={ancestor.id}
                                                                            className={
                                                                                !isLast
                                                                                    ? "text-muted-foreground mr-1"
                                                                                    : "mr-1"
                                                                            }
                                                                        >
                                                                            {ancestor.title}
                                                                            {!isLast ? " / " : ""}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    <Button
                        onClick={handleCreatePage}
                        disabled={isCreateDisabled}
                        className="h-8 w-full cursor-pointer text-sm"
                        variant="default"
                    >
                        {isCreating ? "Creating..." : "Create"}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
