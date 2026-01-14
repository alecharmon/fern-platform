"use client";

/**
 * Description Edit Modal
 *
 * Modal dialog for editing API reference descriptions.
 * Provides a textarea for editing markdown and shows the file being modified.
 */

import { FileCode, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useDescriptionEdit } from "@/providers/OpenApiSpecsContext";
import { cn } from "@/utils/utils";
import { Button } from "../ui/button";

export interface DescriptionEditModalProps {
    /** Additional class names */
    className?: string;
}

/**
 * Modal for editing descriptions.
 * Automatically shows when editingState is set in context.
 */
export function DescriptionEditModal({ className }: DescriptionEditModalProps) {
    const { editingState, cancelEditing, saveDescription } = useDescriptionEdit();
    const [value, setValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync value when editing state changes
    useEffect(() => {
        if (editingState) {
            setValue(editingState.currentValue);
            setError(null);
        }
    }, [editingState]);

    const handleSave = useCallback(async () => {
        if (!editingState) {
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await saveDescription(value);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save description");
        } finally {
            setIsSaving(false);
        }
    }, [editingState, value, saveDescription]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // Save on Cmd/Ctrl + Enter
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSave();
            }
            // Cancel on Escape
            if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
            }
        },
        [handleSave, cancelEditing]
    );

    if (!editingState) {
        return null;
    }

    const fileName = editingState.filePath.split("/").pop() || editingState.filePath;
    const hasChanges = value !== editingState.currentValue;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={cancelEditing} />

            {/* Modal */}
            <div
                className={cn(
                    "relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-(color:--grayscale-a6) bg-(color:--background) shadow-xl",
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-(color:--grayscale-a6) px-4 py-3">
                    <div className="flex items-center gap-2">
                        <FileCode className="size-4 text-(color:--grayscale-a11)" />
                        <span className="text-sm font-medium">Edit Description</span>
                    </div>
                    <button
                        type="button"
                        onClick={cancelEditing}
                        className="rounded p-1 text-(color:--grayscale-a11) hover:bg-(color:--grayscale-a3) hover:text-(color:--grayscale-a12)"
                        aria-label="Close"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* File path info */}
                <div className="border-b border-(color:--grayscale-a6) bg-(color:--grayscale-a2) px-4 py-2">
                    <div className="flex items-center gap-2 text-xs text-(color:--grayscale-a11)">
                        <span>Editing:</span>
                        <code className="rounded bg-(color:--grayscale-a3) px-1.5 py-0.5 font-mono">{fileName}</code>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-(color:--grayscale-a9)">
                        {editingState.jsonPath.join(" → ")}
                    </div>
                </div>

                {/* Textarea */}
                <div className="flex-1 overflow-auto p-4">
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter description (Markdown supported)"
                        className={cn(
                            "h-48 w-full resize-none rounded-md border border-(color:--grayscale-a6) bg-(color:--background) px-3 py-2 font-mono text-sm",
                            "placeholder:text-(color:--grayscale-a9)",
                            "focus:border-(color:--accent-a8) focus:outline-none focus:ring-1 focus:ring-(color:--accent-a8)"
                        )}
                        autoFocus
                    />
                    <p className="mt-2 text-xs text-(color:--grayscale-a9)">
                        Markdown formatting is supported. Press{" "}
                        <kbd className="rounded bg-(color:--grayscale-a3) px-1">Cmd+Enter</kbd> to save or{" "}
                        <kbd className="rounded bg-(color:--grayscale-a3) px-1">Esc</kbd> to cancel.
                    </p>
                </div>

                {/* Error message */}
                {error && (
                    <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-(color:--grayscale-a6) px-4 py-3">
                    <Button variant="outline" size="sm" onClick={cancelEditing} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={() => void handleSave()} disabled={isSaving || !hasChanges}>
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
