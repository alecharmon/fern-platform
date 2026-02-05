"use client";

/**
 * FilesDropdown - Displays changed files in the editor
 *
 * FILE CHANGE KINDS:
 * This component handles 5 types of file changes, each with different behaviors:
 *
 * | Kind          | Source                    | User Action                        | Display       | Diff Preview | Reset | Expandable | Clickable |
 * |---------------|---------------------------|------------------------------------|---------------|--------------|-------|------------|-----------|
 * | page-modified | files.changed             | Create/edit MDX page               | +X -Y         | Yes          | Yes   | No         | Yes       |
 * | page-deleted  | files.deleted             | Delete MDX page                    | "Deleted"     | No           | Yes   | No         | No        |
 * | openapi-spec  | openApiPendingChanges     | Edit OpenAPI description           | +X -Y         | Yes          | Yes   | No         | No        |
 * | generators    | openApiPendingChanges     | Edit generators.yml (override ref) | +X -Y         | Yes          | No    | No         | No        |
 * | navigation    | navigationChanges         | Create/delete page, rename section | "X change(s)" | Yes          | No    | Yes        | No        |
 *
 * Note: Creating a page produces BOTH a page-modified entry AND a navigation entry (add_page).
 *       Deleting a page produces BOTH a page-deleted entry AND a navigation entry (remove_page).
 *       Section creation is implicit in add_page when adding to a new section.
 */

import { useRouter } from "@bprogress/next/app";
import {
    constructEditorSlug,
    isJsonFilePath,
    isYmlFilePath,
    type NavigationChange,
    useNavigation
} from "@fern-docs/components/navigation";
import { type Change, diffLines } from "diff";
import { ChevronDownIcon, ChevronRightIcon, CodeIcon, FileIcon, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useOpenApiSpecs } from "@/providers/OpenApiSpecsContext";
import type { EncodedDocsUrl } from "@/utils/types";

import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { DashboardTooltip } from "./DashboardTooltip";
import { DiffFullViewModal } from "./DiffFullViewModal";
import { DiffPreviewContent } from "./DiffPreviewContent";

type FileChangeKind =
    | { kind: "page-modified"; diffChanges: Change[]; added: number; removed: number }
    | { kind: "page-deleted" }
    | { kind: "openapi-spec"; diffChanges: Change[]; added: number; removed: number }
    | { kind: "generators"; diffChanges: Change[]; added: number; removed: number }
    | {
          kind: "navigation";
          navigationChanges: NavigationChange[];
          diffChanges: Change[];
          added: number;
          removed: number;
      };

interface FileChangeEntry {
    filename: string;
    change: FileChangeKind;
}

type DiffChangeKind = Extract<FileChangeKind, { diffChanges: Change[] }>;

function hasDiffChanges(change: FileChangeKind): change is DiffChangeKind {
    return "diffChanges" in change && change.diffChanges.length > 0 && (change.added > 0 || change.removed > 0);
}

export function FilesDropdown() {
    const {
        branchName,
        metadata,
        files,
        registeredPages,
        navigationChanges,
        resetPage,
        unmarkPageForDeletion,
        docsYmlBaseContent
    } = useNavigation();
    const { pendingChanges: openApiPendingChanges, resetSpecChange } = useOpenApiSpecs();
    const router = useRouter();
    const [resetPopoverOpen, setResetPopoverOpen] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(["docs.yml"]));
    const [diffPopoverOpen, setDiffPopoverOpen] = useState<string | null>(null);
    const [diffModalOpen, setDiffModalOpen] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearHoverTimeout = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
    }, []);

    const clearCloseTimeout = useCallback(() => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    }, []);

    const scheduleClose = useCallback(() => {
        clearCloseTimeout();
        closeTimeoutRef.current = setTimeout(() => setDiffPopoverOpen(null), 300);
    }, [clearCloseTimeout]);

    const preventDropdownClose = useCallback((e: Event) => {
        if ((e.target as HTMLElement).closest('[data-slot="dropdown-menu-content"]')) {
            e.preventDefault();
        }
    }, []);

    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
            if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
            }
        };
    }, []);

    // Group navigation changes by yml file
    const changesByYmlFile = useMemo(() => {
        const grouped = new Map<string, NavigationChange[]>();
        for (const change of navigationChanges.values()) {
            if (change.committed) {
                continue;
            }
            const filePath = change.docsYmlFilePath;
            const fileChanges = grouped.get(filePath) ?? [];
            fileChanges.push(change as NavigationChange);
            grouped.set(filePath, fileChanges);
        }
        return grouped;
    }, [navigationChanges]);

    // Build the list of all changed files with their classified change kind
    const fileChanges = useMemo((): FileChangeEntry[] => {
        const entries: FileChangeEntry[] = [];
        const processedFiles = new Set<string>();

        // Helper to calculate diff stats
        const calcDiff = (original: string, current: string) => {
            const diff = diffLines(original, current);
            let added = 0;
            let removed = 0;
            for (const part of diff) {
                if (part.added) {
                    added += part.count ?? 0;
                } else if (part.removed) {
                    removed += part.count ?? 0;
                }
            }
            return { diff, added, removed };
        };

        // Process deleted files first (page-deleted)
        for (const filename of files.deleted) {
            if (processedFiles.has(filename)) {
                continue;
            }
            processedFiles.add(filename);
            entries.push({
                filename,
                change: { kind: "page-deleted" }
            });
        }

        // Process pending changes (openapi-spec or generators)
        for (const [filename, openApiChange] of openApiPendingChanges) {
            if (processedFiles.has(filename)) {
                continue;
            }
            processedFiles.add(filename);

            const { diff, added, removed } = calcDiff(openApiChange.originalContent, openApiChange.currentContent);
            if (filename.includes("generators")) {
                entries.push({
                    filename,
                    change: { kind: "generators", diffChanges: diff, added, removed }
                });
            } else {
                entries.push({
                    filename,
                    change: { kind: "openapi-spec", diffChanges: diff, added, removed }
                });
            }
        }

        // Process navigation yml files
        for (const [filename, navChanges] of changesByYmlFile) {
            if (processedFiles.has(filename)) {
                continue;
            }
            processedFiles.add(filename);

            const originalContent = docsYmlBaseContent?.get(filename);
            const updatedContent = files.changed[filename];
            const diffData =
                originalContent != null && updatedContent != null
                    ? calcDiff(originalContent, updatedContent)
                    : { diff: [], added: 0, removed: 0 };

            entries.push({
                filename,
                change: {
                    kind: "navigation",
                    navigationChanges: navChanges,
                    diffChanges: diffData.diff,
                    added: diffData.added,
                    removed: diffData.removed
                }
            });
        }

        // Process changed MDX files (page-modified)
        for (const filename of Object.keys(files.changed)) {
            if (processedFiles.has(filename)) {
                continue;
            }
            processedFiles.add(filename);

            const pageEntry = registeredPages[filename];
            const initial = pageEntry?.initialMdx ?? "";
            const changed = files.changed[filename] ?? "";
            const { diff, added, removed } = calcDiff(initial, changed);

            entries.push({
                filename,
                change: { kind: "page-modified", diffChanges: diff, added, removed }
            });
        }

        // Sort: non-yml files first, then yml files with docs.yml at the top
        return entries.sort((a, b) => {
            const aIsYml = isYmlFilePath(a.filename);
            const bIsYml = isYmlFilePath(b.filename);

            if (aIsYml && !bIsYml) {
                return 1;
            }
            if (!aIsYml && bIsYml) {
                return -1;
            }
            if (aIsYml && bIsYml) {
                if (a.filename === "docs.yml") {
                    return -1;
                }
                if (b.filename === "docs.yml") {
                    return 1;
                }
            }
            return a.filename.localeCompare(b.filename);
        });
    }, [files.deleted, files.changed, openApiPendingChanges, changesByYmlFile, registeredPages, docsYmlBaseContent]);

    const changedFilesCount = fileChanges.length;

    const handleResetClick = (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setResetPopoverOpen(filename);
    };

    const handleConfirmReset = (entry: FileChangeEntry) => {
        switch (entry.change.kind) {
            case "page-deleted":
                unmarkPageForDeletion(entry.filename);
                break;
            case "openapi-spec":
                resetSpecChange(entry.filename);
                break;
            case "page-modified":
                resetPage(entry.filename);
                break;
        }
        setResetPopoverOpen(null);
    };

    const toggleExpanded = (filename: string) => {
        setExpandedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    };

    const handleFileClick = (entry: FileChangeEntry) => {
        if (entry.change.kind !== "page-modified") {
            return;
        }

        const pageEntry = registeredPages[entry.filename];
        if (!pageEntry?.pageData.foundNode.node) {
            console.warn("No page data found for filename:", entry.filename);
            return;
        }

        const node = pageEntry.pageData.foundNode.node;
        if (node.type !== "page") {
            console.warn("Node is not a page:", node.type);
            return;
        }

        router.push(
            constructEditorSlug({
                orgName: metadata.orgName as Auth0OrgName,
                docsUrl: metadata.docsUrl as EncodedDocsUrl,
                branchName: branchName,
                slug: node.slug
            })
        );
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

    const getNavigationChangeLabel = (change: NavigationChange) => {
        if (change.type === "add_page" && change.pageEntry) {
            return `Page created: "${change.pageEntry.page}"`;
        }
        if (change.type === "remove_page" && change.pageEntry) {
            return `Page deleted: "${change.pageEntry.page}"`;
        }
        if (change.type === "rename_section" && change.newTitle) {
            return `Section renamed to "${change.newTitle}"`;
        }
        return "";
    };

    // Render the stats/badge area based on change kind
    const renderStats = (entry: FileChangeEntry) => {
        switch (entry.change.kind) {
            case "page-deleted":
                return <span className="text-xs font-medium text-red-600">Deleted</span>;
            case "navigation":
                return (
                    <span className="text-muted-foreground text-xs">
                        {entry.change.navigationChanges.length}{" "}
                        {entry.change.navigationChanges.length === 1 ? "change" : "changes"}
                    </span>
                );
            case "page-modified":
            case "openapi-spec":
            case "generators":
                return (
                    <>
                        {entry.change.added > 0 && (
                            <span className="text-green-1100 font-mono text-xs">+{entry.change.added}</span>
                        )}
                        {entry.change.removed > 0 && (
                            <span className="font-mono text-xs text-red-600">-{entry.change.removed}</span>
                        )}
                    </>
                );
        }
    };

    // Render the expanded content based on change kind
    const renderExpandedContent = (entry: FileChangeEntry) => {
        switch (entry.change.kind) {
            case "navigation":
                if (entry.change.navigationChanges.length === 0) {
                    return <div className="text-muted-foreground px-2 py-1 text-xs italic">No changes</div>;
                }
                return entry.change.navigationChanges.map((change, idx) => {
                    const changeKey =
                        change.type === "add_page" && change.pageEntry
                            ? `add-${change.pageEntry.path}`
                            : change.type === "remove_page" && change.pageEntry
                              ? `remove-${change.pageEntry.path}`
                              : change.type === "rename_section"
                                ? `rename-${change.sectionId}-${idx}`
                                : `change-${idx}`;

                    return (
                        <div key={changeKey} className="text-muted-foreground rounded px-2 py-1 text-xs">
                            {getNavigationChangeLabel(change)}
                        </div>
                    );
                });
            default:
                return null;
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-8 gap-1.5 py-2 hover:bg-gray-200"
                    >
                        <div className="text-green-1100 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-300 px-1 text-xs">
                            {changedFilesCount}
                        </div>
                        <span className="mb-[1px] text-sm">Files</span>
                        <ChevronDownIcon className="text-muted-foreground size-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="m-1 min-w-[280px] overflow-hidden rounded-lg border border-gray-500 bg-white px-2 py-3 shadow-lg"
                    sideOffset={4}
                >
                    <div className="bg-white px-2 pb-1">
                        <span className="text-foreground text-xs font-bold">Changed files</span>
                    </div>
                    {changedFilesCount === 0 ? (
                        <div className="text-muted-foreground px-4 py-8 text-center text-sm">No changed files</div>
                    ) : (
                        <div className="max-h-[320px] overflow-y-auto">
                            {fileChanges.map((entry) => {
                                const { kind } = entry.change;
                                const expandable = kind === "navigation";
                                const isExpanded = expandedFiles.has(entry.filename);
                                const showReset =
                                    kind === "page-modified" || kind === "page-deleted" || kind === "openapi-spec";
                                const clickable = kind === "page-modified";
                                const diffPreview = hasDiffChanges(entry.change);

                                return (
                                    <div key={entry.filename}>
                                        <DropdownMenuItem
                                            className="text-muted-foreground hover:text-foreground m-0 p-0 flex items-center justify-between hover:bg-gray-300 gap-1 cursor-default"
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            <Popover
                                                open={diffPopoverOpen === entry.filename}
                                                onOpenChange={(open) => {
                                                    if (!open) {
                                                        clearHoverTimeout();
                                                        setDiffPopoverOpen(null);
                                                    }
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <div
                                                        className={`ml-1 flex min-w-0 flex-1 items-center justify-between gap-1 min-h-[36px] px-1.5 ${expandable ? "cursor-pointer" : "cursor-default"}`}
                                                        onClick={() => {
                                                            if (expandable) {
                                                                toggleExpanded(entry.filename);
                                                            }
                                                        }}
                                                        onMouseEnter={() => {
                                                            clearCloseTimeout();
                                                            clearHoverTimeout();
                                                            if (
                                                                diffPopoverOpen != null &&
                                                                diffPopoverOpen !== entry.filename
                                                            ) {
                                                                setDiffPopoverOpen(null);
                                                            }
                                                            if (diffPreview) {
                                                                hoverTimeoutRef.current = setTimeout(() => {
                                                                    setDiffPopoverOpen(entry.filename);
                                                                }, 300);
                                                            }
                                                        }}
                                                        onMouseLeave={() => {
                                                            clearHoverTimeout();
                                                            scheduleClose();
                                                        }}
                                                    >
                                                        {expandable && (
                                                            <ChevronRightIcon
                                                                className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                                            />
                                                        )}
                                                        <div className="shrink-0">
                                                            {isYmlFilePath(entry.filename) ||
                                                            isJsonFilePath(entry.filename) ? (
                                                                <CodeIcon className="size-3 text-inherit" />
                                                            ) : (
                                                                <FileIcon className="size-3 text-inherit" />
                                                            )}
                                                        </div>
                                                        <span
                                                            className={`truncate text-sm ${clickable && "cursor-pointer hover:underline"}`}
                                                            title={entry.filename}
                                                            onClick={() => {
                                                                if (clickable) {
                                                                    handleFileClick(entry);
                                                                }
                                                            }}
                                                        >
                                                            /{truncateFilename(entry.filename)}
                                                        </span>
                                                        <div className="flex-1" />
                                                        <div className="flex shrink-0 items-center gap-1">
                                                            {renderStats(entry)}
                                                        </div>
                                                    </div>
                                                </PopoverTrigger>
                                                {hasDiffChanges(entry.change) && (
                                                    <PopoverContent
                                                        side="right"
                                                        align="start"
                                                        sideOffset={8}
                                                        className="max-w-[360px] border-0 bg-transparent p-0 shadow-lg"
                                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                                        onMouseEnter={() => {
                                                            clearCloseTimeout();
                                                            clearHoverTimeout();
                                                        }}
                                                        onMouseLeave={() => {
                                                            scheduleClose();
                                                        }}
                                                        onInteractOutside={preventDropdownClose}
                                                    >
                                                        <DiffPreviewContent
                                                            diffChanges={entry.change.diffChanges}
                                                            onViewAll={() => {
                                                                setDiffPopoverOpen(null);
                                                                setDiffModalOpen(entry.filename);
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                )}
                                            </Popover>
                                            {showReset && (
                                                <Popover
                                                    open={resetPopoverOpen === entry.filename}
                                                    onOpenChange={(open) => {
                                                        setResetPopoverOpen(open ? entry.filename : null);
                                                    }}
                                                    modal={false}
                                                >
                                                    <DashboardTooltip
                                                        content={
                                                            resetPopoverOpen === entry.filename
                                                                ? undefined
                                                                : "Reset changes"
                                                        }
                                                        delayDuration={300}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="size-7 shrink-0 rounded-md border border-gray-500 bg-white p-0 mr-1"
                                                                onClick={(e) => handleResetClick(entry.filename, e)}
                                                            >
                                                                <Undo2 className="text-muted-foreground size-3" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                    </DashboardTooltip>
                                                    <PopoverContent
                                                        side="right"
                                                        align="center"
                                                        sideOffset={8}
                                                        className="w-60"
                                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                                        onInteractOutside={preventDropdownClose}
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
                                                                    onClick={() => handleConfirmReset(entry)}
                                                                >
                                                                    Reset
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </DropdownMenuItem>

                                        {/* Expanded content for expandable items */}
                                        {expandable && isExpanded && (
                                            <div className="ml-6 border-l border-gray-400 py-1 pl-2">
                                                {renderExpandedContent(entry)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <DiffFullViewModal
                open={diffModalOpen != null}
                onOpenChange={(open) => !open && setDiffModalOpen(null)}
                filename={diffModalOpen ?? ""}
                diffChanges={(() => {
                    const entry = fileChanges.find((e) => e.filename === diffModalOpen);
                    return entry && hasDiffChanges(entry.change) ? entry.change.diffChanges : [];
                })()}
            />
        </>
    );
}
