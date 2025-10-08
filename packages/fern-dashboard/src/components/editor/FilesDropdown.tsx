"use client";

import { useRouter } from "@bprogress/next/app";
import { constructEditorSlug, useNavigation } from "@fern-docs/components/navigation";
import { ChevronDownIcon, CodeIcon, FileIcon, Undo2 } from "lucide-react";
import { useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { EncodedDocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { DashboardTooltip } from "./DashboardTooltip";

export function FilesDropdown() {
    const { branchName, metadata, files, registeredPages, resetPage } = useNavigation();
    const router = useRouter();
    const [resetPopoverOpen, setResetPopoverOpen] = useState<string | null>(null);

    const changedFilesList = Object.keys(files.changed).filter((filename) => filename !== "docs.yml");
    const changedFilesCount = changedFilesList.length;

    const handleResetClick = (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setResetPopoverOpen(filename);
    };

    const handleConfirmReset = (filename: string) => {
        resetPage(filename);
        setResetPopoverOpen(null);
    };

    const handleFileClick = (filename: string) => {
        // Skip navigation for docs.yml
        if (filename === "docs.yml") {
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
                slug: node.slug,
                query: {
                    clientPage: pageEntry.pageData.source === "client"
                }
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
                            {changedFilesList.map((filename) => (
                                <DropdownMenuItem
                                    key={filename}
                                    className="flex cursor-pointer items-center justify-between gap-3 p-1 mx-0 hover:bg-gray-300 text-muted-foreground hover:text-foreground"
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    <div
                                        className="flex min-w-0 flex-1 items-center gap-2 ml-1"
                                        onClick={() => handleFileClick(filename)}
                                    >
                                        <div className="shrink-0">{getFileIcon(filename)}</div>
                                        <span className="truncate text-sm" title={filename}>
                                            /{truncateFilename(filename)}
                                        </span>
                                    </div>
                                    <Popover
                                        open={resetPopoverOpen === filename}
                                        onOpenChange={(open) => {
                                            setResetPopoverOpen(open ? filename : null);
                                        }}
                                        modal={false}
                                    >
                                        <DashboardTooltip
                                            content={resetPopoverOpen === filename ? undefined : "Reset changes"}
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
                                </DropdownMenuItem>
                            ))}
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
