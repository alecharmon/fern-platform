"use client";

import { useRouter } from "@bprogress/next/app";
import { constructEditorSlug, useNavigation } from "@fern-docs/components/navigation";
import { diffLines } from "diff";
import { ChevronDownIcon, ChevronRightIcon, CodeIcon, FileIcon, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { EncodedDocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { DashboardTooltip } from "./DashboardTooltip";

export function FilesDropdown() {
    const { branchName, metadata, files, registeredPages, docsYmlChanges, resetPage, unmarkPageForDeletion } =
        useNavigation();
    const router = useRouter();
    const [resetPopoverOpen, setResetPopoverOpen] = useState<string | null>(null);
    const [expandedDocsYml, setExpandedDocsYml] = useState(true);

    const filteredDocsYmlChanges = useMemo(
        () => Array.from(docsYmlChanges.values()).filter((change) => !change.committed),
        [docsYmlChanges]
    );

    const allChangedFiles = useMemo(() => {
        const changedFilesList = Object.keys(files.changed);
        // files.deleted now only contains uncommitted deletions (committed ones are filtered out in NavigationStore)
        const allFiles = [...changedFilesList, ...files.deleted];

        // Move docs.yml to the end of the list
        const docsYmlIndex = allFiles.indexOf("docs.yml");
        if (docsYmlIndex !== -1) {
            allFiles.splice(docsYmlIndex, 1);
            allFiles.push("docs.yml");
        }

        // Only include docs.yml if there are uncommitted changes
        return allFiles.filter((filename) => filename !== "docs.yml" || filteredDocsYmlChanges.length > 0);
    }, [files.changed, files.deleted, filteredDocsYmlChanges]);

    const changedFilesCount = allChangedFiles.length;

    // Calculate diff stats for each file
    const fileDiffStats = useMemo(() => {
        const stats: Record<string, { added: number; removed: number; isDeleted: boolean }> = {};

        for (const filename of allChangedFiles) {
            const pageEntry = registeredPages[filename];
            const isDeleted = files.deleted.includes(filename);

            if (isDeleted) {
                stats[filename] = { added: 0, removed: 0, isDeleted: true };
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
    }, [registeredPages, files.changed, files.deleted, allChangedFiles]);

    const handleResetClick = (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setResetPopoverOpen(filename);
    };

    const handleConfirmReset = (filename: string) => {
        const stats = fileDiffStats[filename];
        if (stats?.isDeleted) {
            unmarkPageForDeletion(filename);
        } else {
            resetPage(filename);
        }
        setResetPopoverOpen(null);
    };

    const isClickable = (filename: string) => {
        return filename !== "docs.yml";
    };

    const handleFileClick = (filename: string) => {
        // Skip navigation for docs.yml
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
        if (filename === "docs.yml") {
            return <CodeIcon className="size-3 text-inherit" />;
        }
        // Default to file icon
        return <FileIcon className="size-3 text-inherit" />;
    };

    const truncateFilename = (filename: string) => {
        const maxLength = 24;
        if (filename.length <= maxLength) return filename;

        const parts = filename.split("/");
        if (parts.length > 2) {
            return `${parts[0]}/.../${parts[parts.length - 1]}`;
        }
        return filename;
    };

    const getDocsYmlChangeLabel = (change: typeof docsYmlChanges extends Map<any, infer T> ? T : never) => {
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
                                const isDocsYml = filename === "docs.yml";

                                return (
                                    <div key={filename}>
                                        <DropdownMenuItem
                                            className="flex items-center justify-between gap-3 p-1 mx-0 hover:bg-gray-300 text-muted-foreground hover:text-foreground cursor-pointer"
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            <div
                                                className="flex min-w-0 flex-1 items-center gap-2 ml-1 cursor-pointer"
                                                onClick={() => {
                                                    if (isDocsYml) {
                                                        setExpandedDocsYml(!expandedDocsYml);
                                                    } else {
                                                        handleFileClick(filename);
                                                    }
                                                }}
                                            >
                                                {isDocsYml && (
                                                    <ChevronRightIcon
                                                        className={`size-3 transition-transform ${expandedDocsYml ? "rotate-90" : ""}`}
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
                                                ) : isDocsYml ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        {filteredDocsYmlChanges.length}{" "}
                                                        {filteredDocsYmlChanges.length === 1 ? "change" : "changes"}
                                                    </span>
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
                                            {!isDocsYml && (
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

                                        {/* Nested docs.yml changes */}
                                        {isDocsYml && expandedDocsYml && (
                                            <div className="ml-6 border-l border-gray-400 pl-2 py-1">
                                                {filteredDocsYmlChanges.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground py-1 px-2 italic">
                                                        No changes
                                                    </div>
                                                ) : (
                                                    filteredDocsYmlChanges.map((change, idx) => {
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
