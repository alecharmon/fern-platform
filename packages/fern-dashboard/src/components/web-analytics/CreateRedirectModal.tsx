"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { createRedirectPrAction } from "@/app/actions/createRedirectPr";
import { getValidPagePaths } from "@/app/actions/getValidPagePaths";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findBestMatch, findTopMatches } from "@/utils/fuzzyMatch";
import type { DocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";

interface CreateRedirectModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourcePath: string;
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
    gitUrl: string;
    baseBranch: string;
}

export function CreateRedirectModal({
    open,
    onOpenChange,
    sourcePath,
    orgName,
    docsUrl,
    gitUrl,
    baseBranch
}: CreateRedirectModalProps) {
    const [destinationPath, setDestinationPath] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validPaths, setValidPaths] = useState<string[]>([]);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [prUrl, setPrUrl] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            setError(null);
            setIsLoading(false);
            setDestinationPath("");
            setSearchTerm("");
            setPrUrl(null);

            getValidPagePaths(docsUrl).then((result) => {
                if (result.success && result.paths) {
                    setValidPaths(result.paths);

                    const bestMatch = findBestMatch(sourcePath, result.paths, 0.4);
                    if (bestMatch) {
                        setDestinationPath(bestMatch.path);
                    }
                }
            });
        }
    }, [open, sourcePath, docsUrl]);

    useEffect(() => {
        if (validPaths.length > 0) {
            const searchValue = searchTerm || destinationPath || sourcePath;
            const matches = findTopMatches(searchValue, validPaths, 10, 0.3);
            setFilteredSuggestions(matches.map((m) => m.path));
        } else {
            setFilteredSuggestions([]);
        }
    }, [searchTerm, destinationPath, validPaths, sourcePath]);

    const handleCreateRedirect = useCallback(async () => {
        if (!destinationPath.trim()) {
            setError("Destination path is required");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await createRedirectPrAction(
                orgName,
                docsUrl,
                gitUrl,
                sourcePath,
                destinationPath,
                baseBranch
            );

            if (result.success) {
                if (result.prUrl) {
                    setPrUrl(result.prUrl);
                }
            } else {
                setError(result.error || "Failed to create redirect");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    }, [destinationPath, orgName, docsUrl, gitUrl, sourcePath, baseBranch]);

    // Reset highlighted index when suggestions change
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset highlighted index when suggestions change
    useEffect(() => {
        setHighlightedIndex(0);
    }, [filteredSuggestions]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (isPopoverOpen && listRef.current) {
            const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
            if (highlightedElement) {
                highlightedElement.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth"
                });
            }
        }
    }, [highlightedIndex, isPopoverOpen]);

    // Focus search input when popover opens
    useEffect(() => {
        if (isPopoverOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 0);
        } else {
            setSearchTerm("");
        }
    }, [isPopoverOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (filteredSuggestions.length > 0) {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setHighlightedIndex((prev) => Math.min(prev + 1, filteredSuggestions.length - 1));
                    return;
                case "ArrowUp":
                    e.preventDefault();
                    setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    return;
                case "Enter":
                    e.preventDefault();
                    if (filteredSuggestions[highlightedIndex]) {
                        setDestinationPath(filteredSuggestions[highlightedIndex]);
                        setIsPopoverOpen(false);
                    }
                    return;
                case "Escape":
                    e.preventDefault();
                    setIsPopoverOpen(false);
                    return;
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoading && destinationPath.trim()) {
            void handleCreateRedirect();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create 404 Redirect</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <DialogBody>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label
                                    htmlFor="source-path"
                                    className="text-sm font-medium text-gray-700 dark:text-white"
                                >
                                    From
                                </label>
                                <Input
                                    id="source-path"
                                    value={sourcePath}
                                    disabled
                                    className="mt-1 bg-gray-100 dark:bg-gray-800"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="destination-path"
                                    className="text-sm font-medium text-gray-700 dark:text-white"
                                >
                                    To
                                </label>
                                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "border-input shadow-xs dark:bg-input/30 mt-1 flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 py-1 text-sm outline-none transition-[color,box-shadow]",
                                                "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                                "focus-visible:border-ring focus-visible:ring-ring/30 cursor-pointer focus-visible:ring-[3px]",
                                                !destinationPath && "text-gray-500"
                                            )}
                                        >
                                            <span className="truncate">{destinationPath || "/docs/path/to/page"}</span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-[var(--radix-popover-trigger-width)] p-0"
                                        align="start"
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                        onWheel={(e) => e.stopPropagation()}
                                    >
                                        <div className="border-b border-gray-200 p-2 dark:border-gray-700">
                                            <Input
                                                ref={searchInputRef}
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Search paths..."
                                                className="h-8 border-0 shadow-none focus-visible:ring-0"
                                            />
                                        </div>
                                        <div
                                            ref={listRef}
                                            className="z-50 max-h-[300px] overflow-y-auto py-1"
                                            style={{ overscrollBehavior: "contain" }}
                                        >
                                            {filteredSuggestions.length === 0 ? (
                                                <div className="px-3 py-2 text-center text-sm text-gray-500">
                                                    No paths found
                                                </div>
                                            ) : (
                                                filteredSuggestions.map((path, index) => (
                                                    <div
                                                        key={path}
                                                        className={cn(
                                                            "cursor-pointer px-3 py-2 text-sm",
                                                            index === highlightedIndex
                                                                ? "bg-gray-100 dark:bg-gray-700"
                                                                : "hover:bg-gray-50 dark:hover:bg-gray-800"
                                                        )}
                                                        onClick={() => {
                                                            setDestinationPath(path);
                                                            setIsPopoverOpen(false);
                                                        }}
                                                        onMouseEnter={() => setHighlightedIndex(index)}
                                                    >
                                                        {path}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {prUrl && (
                                <a
                                    href={prUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary mt-1 flex items-center gap-2 text-base"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    View Redirect PR
                                </a>
                            )}
                            {error && (
                                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                                    {error}
                                </div>
                            )}
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Dismiss
                        </Button>
                        <Button type="submit" disabled={isLoading || !destinationPath.trim() || prUrl !== null}>
                            {isLoading ? "Creating..." : prUrl ? "Redirect Created" : "Create Redirect"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
