"use client";

import { useRouter } from "@bprogress/next/app";
import { constructEditorSlug, isYmlFilePath, useNavigation } from "@fern-docs/components/navigation";
import { diffLines } from "diff";
import { ChevronDownIcon, ChevronRightIcon, CodeIcon, FileIcon, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useOpenApiSpecs } from "@/providers/OpenApiSpecsContext";
import type { EncodedDocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { DashboardTooltip } from "./DashboardTooltip";

export function FilesDropdown() {
    const { branchName, metadata, files, registeredPages, navigationChanges, resetPage, unmarkPageForDeletion } =
        useNavigation();
    const { pendingChanges: openApiPendingChanges, resetSpecChange } = useOpenApiSpecs();
    const router = useRouter();
    const [resetPopoverOpen, setResetPopoverOpen] = useState<string | null>(null);
    const [expandedYmlFiles, setExpandedYmlFiles] = useState<Set<string>>(new Set(["docs.yml"]));

    const filteredNavigationChanges = useMemo(
        () => Array.from(navigationChanges.values()).filter((change) => !change.committed),
        [navigationChanges]
    );

    // Group changes by yml file
    const changesByYmlFile = useMemo(() => {
        const grouped = new Map<string, typeof filteredNavigationChanges>();
        for (const change of filteredNavigationChanges) {
            const filePath = change.docsYmlFilePath;
            const fileChanges = grouped.get(filePath) ?? [];
            fileChanges.push(change);
            grouped.set(filePath, fileChanges);
        }
        return grouped;
    }, [filteredNavigationChanges]);

    // Get OpenAPI spec file paths that have pending changes
    const openApiChangedFiles = useMemo(() => {
        return Array.from(openApiPendingChanges.keys());
    }, [openApiPendingChanges]);

    const allChangedFiles = useMemo(() => {
        const changedFilesList = Object.keys(files.changed);
        // files.deleted now only contains uncommitted deletions (committed ones are filtered out in NavigationStore)
        const allFiles = [...changedFilesList, ...files.deleted];

        // Add OpenAPI spec files that have pending changes
        const allFilesWithOpenApi = [...allFiles, ...openApiChangedFiles.filter((f) => !allFiles.includes(f))];

        // Separate yml files from other files
        const ymlFiles = allFilesWithOpenApi.filter((f) => isYmlFilePath(f));
        const otherFiles = allFilesWithOpenApi.filter((f) => !isYmlFilePath(f));

        // Sort yml files, putting docs.yml first
        ymlFiles.sort((a, b) => {
            if (a === "docs.yml") {
                return -1;
            }
            if (b === "docs.yml") {
                return 1;
            }
            return a.localeCompare(b);
        });

        // Return other files first, then yml files at the end
        return [...otherFiles, ...ymlFiles].filter((filename) => {
            // Only include yml files if they have uncommitted changes (navigation or OpenAPI)
            if (isYmlFilePath(filename)) {
                // Include if it has navigation changes OR OpenAPI pending changes
                return changesByYmlFile.has(filename) || openApiPendingChanges.has(filename);
            }
            return true;
        });
    }, [files.changed, files.deleted, changesByYmlFile, openApiChangedFiles, openApiPendingChanges]);

    const changedFilesCount = allChangedFiles.length;

    // Calculate diff stats for each file (skip yml files as they use specialized UI)
    const fileDiffStats = useMemo(() => {
        const stats: Record<string, { added: number; removed: number; isDeleted: boolean; isOpenApiSpec?: boolean }> =
            {};

        for (const filename of allChangedFiles) {
            const pageEntry = registeredPages[filename];
            const isDeleted = files.deleted.includes(filename);
            const openApiChange = openApiPendingChanges.get(filename);

            if (isDeleted) {
                stats[filename] = { added: 0, removed: 0, isDeleted: true };
            } else if (openApiChange) {
                // Calculate diff for OpenAPI spec files
                const diff = diffLines(openApiChange.originalContent, openApiChange.currentContent);
                let added = 0;
                let removed = 0;

                for (const part of diff) {
                    if (part.added) {
                        added += part.count ?? 0;
                    } else if (part.removed) {
                        removed += part.count ?? 0;
                    }
                }

                stats[filename] = { added, removed, isDeleted: false, isOpenApiSpec: true };
            } else if (isYmlFilePath(filename)) {
                // Skip diff calculation for yml files - they use specialized UI
                stats[filename] = { added: 0, removed: 0, isDeleted: false };
            } else {
                // For changed files, calculate diff
                const initial = pageEntry?.initialMdx ?? "";
                const changed = files.changed[filename] ?? "";

                const diff = diffLines(initial, changed);
                let added = 0;
                let removed = 0;

                for (const part of diff) {
                    if (part.added) {
                        added += part.count ?? 0;
                    } else if (part.removed) {
                        removed += part.count ?? 0;
                    }
                }

                stats[filename] = { added, removed, isDeleted: false };
            }
        }

        return stats;
    }, [registeredPages, files.changed, files.deleted, allChangedFiles, openApiPendingChanges]);

    const handleResetClick = (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setResetPopoverOpen(filename);
    };

    const handleConfirmReset = (filename: string) => {
        const stats = fileDiffStats[filename];
        if (stats?.isDeleted) {
            unmarkPageForDeletion(filename);
        } else if (stats?.isOpenApiSpec) {
            resetSpecChange(filename);
        } else {
            resetPage(filename);
        }
        setResetPopoverOpen(null);
    };

    const isClickable = (filename: string) => {
        return !isYmlFilePath(filename);
    };

    const toggleYmlExpanded = (filename: string) => {
        setExpandedYmlFiles((prev) => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    };

    const handleFileClick = (filename: string) => {
        // Skip navigation for yml files
        if (!isClickable(filename)) {
            return;
        }

        // Get the page data from the registry
        const pageEntry = registeredPages[filename];
        if (!pageEntry?.pageData.foundNode.node) {
            console.warn("No page data found for filename:", filename);
            return;
        }

        const node = pageEntry.pageData.foundNode.node;
        if (node.type !== "page") {
            console.warn("Node is not a page:", node.type);
            return;
        }

        // Construct the editor URL with the page slug
        router.push(
            constructEditorSlug({
                orgName: metadata.orgName as Auth0OrgName,
                docsUrl: metadata.docsUrl as EncodedDocsUrl,
                branchName: branchName,
                slug: node.slug
            })
        );
    };

    const getFileIcon = (filename: string) => {
        if (isYmlFilePath(filename)) {
            return <CodeIcon className="size-3 text-inherit" />;
        }
        // Default to file icon
        return <FileIcon className="size-3 text-inherit" />;
    };

    const truncateFilename = (filename: string) => {
        const maxLength = 24;
        if (filename.length <= maxLength) {
            return filename;
        }

        const parts = filename.split("/");
        if (parts.length > 2) {
            return `${parts[0]}/.../${parts[parts.length - 1]}`;
        }
        return filename;
    };

    const getDocsYmlChangeLabel = (change: typeof navigationChanges extends Map<any, infer T> ? T : never) => {
        if (change.type === "add_page") {
            return `Page created: "${change.pageEntry.page}"`;
        }
        if (change.type === "remove_page") {
            return `Page deleted: "${change.pageEntry.page}"`;
        }
        if (change.type === "rename_section") {
            return `Section renamed to "${change.newTitle}"`;
        }
        return "";
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 py-2 h-8 text-muted-foreground hover:bg-gray-200"
                    >
                        <div className="text-green-1100 text-xs h-4 min-w-4 px-1 rounded-full bg-green-300 flex items-center justify-center">
                            {changedFilesCount}
                        </div>
                        <span className="text-sm mb-[1px]">Files</span>
                        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="min-w-[280px] px-2 py-3 m-1 bg-white border border-gray-500 shadow-lg rounded-lg overflow-hidden"
                    sideOffset={4}
                >
                    <div className="px-2 pb-1 bg-white">
                        <span className="text-xs font-bold text-foreground">Changed files</span>
                    </div>
                    {changedFilesCount === 0 ? (
                        <div className="text-muted-foreground px-4 py-8 text-center text-sm">No changed files</div>
                    ) : (
                        <div className="max-h-[320px] overflow-y-auto">
                            {allChangedFiles.map((filename) => {
                                const stats = fileDiffStats[filename] ?? { added: 0, removed: 0, isDeleted: false };
                                const isYml = isYmlFilePath(filename);
                                const isExpanded = expandedYmlFiles.has(filename);
                                const ymlChanges = isYml ? (changesByYmlFile.get(filename) ?? []) : [];

                                return (
                                    <div key={filename}>
                                        <DropdownMenuItem
                                            className="flex items-center justify-between gap-3 p-1 mx-0 hover:bg-gray-300 text-muted-foreground hover:text-foreground cursor-pointer"
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            <div
                                                className="flex min-w-0 flex-1 items-center gap-2 ml-1 cursor-pointer"
                                                onClick={() => {
                                                    if (isYml) {
                                                        toggleYmlExpanded(filename);
                                                    } else {
                                                        handleFileClick(filename);
                                                    }
                                                }}
                                            >
                                                {isYml && (
                                                    <ChevronRightIcon
                                                        className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                                    />
                                                )}
                                                <div className="shrink-0">{getFileIcon(filename)}</div>
                                                <span className="truncate text-sm" title={filename}>
                                                    /{truncateFilename(filename)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {stats.isDeleted ? (
                                                    <span className="text-xs text-red-600 font-medium">Deleted</span>
                                                ) : isYml && !stats.isOpenApiSpec ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        {ymlChanges.length}{" "}
                                                        {ymlChanges.length === 1 ? "change" : "changes"}
                                                    </span>
                                                ) : filename.includes("generators") ? (
                                                    <span className="text-xs text-muted-foreground">1 change</span>
                                                ) : (
                                                    <>
                                                        {stats.added > 0 && (
                                                            <span className="text-xs text-green-1100 font-mono">
                                                                +{stats.added}
                                                            </span>
                                                        )}
                                                        {stats.removed > 0 && (
                                                            <span className="text-xs text-red-600 font-mono">
                                                                -{stats.removed}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {(!isYml || (stats.isOpenApiSpec && !filename.includes("generators"))) && (
                                                <Popover
                                                    open={resetPopoverOpen === filename}
                                                    onOpenChange={(open) => {
                                                        setResetPopoverOpen(open ? filename : null);
                                                    }}
                                                    modal={false}
                                                >
                                                    <DashboardTooltip
                                                        content={
                                                            resetPopoverOpen === filename ? undefined : "Reset changes"
                                                        }
                                                        delayDuration={300}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="shrink-0 size-7 p-0 rounded-md border bg-white border-gray-500"
                                                                onClick={(e) => handleResetClick(filename, e)}
                                                            >
                                                                <Undo2 className="size-3 text-muted-foreground" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                    </DashboardTooltip>
                                                    <PopoverContent
                                                        side="right"
                                                        align="center"
                                                        sideOffset={8}
                                                        className="w-60"
                                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                                        onInteractOutside={(e) => {
                                                            // Prevent closing when clicking inside the dropdown
                                                            const target = e.target as HTMLElement;
                                                            if (target.closest('[data-slot="dropdown-menu-content"]')) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex flex-col gap-3">
                                                            <div className="text-sm font-semibold">
                                                                Reset all changes on this page?
                                                            </div>

                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setResetPopoverOpen(null)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={() => handleConfirmReset(filename)}
                                                                >
                                                                    Reset
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </DropdownMenuItem>

                                        {/* Nested yml changes */}
                                        {isYml && isExpanded && (
                                            <div className="ml-6 border-l border-gray-400 pl-2 py-1">
                                                {stats.isOpenApiSpec ? (
                                                    <div className="text-xs text-muted-foreground py-1 px-2">
                                                        {filename.includes("generators") ? (
                                                            "Added override file reference"
                                                        ) : (
                                                            <>
                                                                {stats.added > 0 && (
                                                                    <span className="text-green-1100">
                                                                        +{stats.added} lines{" "}
                                                                    </span>
                                                                )}
                                                                {stats.removed > 0 && (
                                                                    <span className="text-red-600">
                                                                        -{stats.removed} lines
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : ymlChanges.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground py-1 px-2 italic">
                                                        No changes
                                                    </div>
                                                ) : (
                                                    ymlChanges.map((change, idx) => {
                                                        // Generate a stable key based on change content
                                                        const changeKey =
                                                            change.type === "add_page"
                                                                ? `add-${change.pageEntry.path}`
                                                                : change.type === "remove_page"
                                                                  ? `remove-${change.pageEntry.path}`
                                                                  : change.type === "rename_section"
                                                                    ? `rename-${change.sectionId}-${idx}`
                                                                    : `change-${idx}`;

                                                        return (
                                                            <div
                                                                key={changeKey}
                                                                className="text-xs text-muted-foreground py-1 px-2 hover:bg-gray-200 rounded"
                                                            >
                                                                {getDocsYmlChangeLabel(change)}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
