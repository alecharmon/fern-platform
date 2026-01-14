"use client";

/**
 * Description Edit Button
 *
 * Inline edit button that appears on hover next to editable descriptions.
 * Uses "hover + indicator" pattern: subtle highlight always visible for editable
 * descriptions, full pencil icon appears on hover.
 */

import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { Pencil, Plus } from "lucide-react";

import { type DescriptionTarget, useDescriptionEdit, useDescriptionEditability } from "@/providers/OpenApiSpecsContext";
import { cn } from "@/utils/utils";

import { getEditDisabledMessage } from "./edit-disabled-message";

export interface DescriptionEditButtonProps {
    /** The description target to edit */
    target: DescriptionTarget;
    /** Current description value */
    currentValue: string;
    /** Additional class names */
    className?: string;
}

/**
 * Standalone edit button (pencil icon).
 */
export function DescriptionEditButton({ target, currentValue, className }: DescriptionEditButtonProps) {
    const { startEditing, isEditingAvailable } = useDescriptionEdit();
    const { isEditable, reason } = useDescriptionEditability(target);

    if (!isEditingAvailable) {
        return null;
    }

    const handleClick = () => {
        if (isEditable) {
            startEditing(target, currentValue);
        }
    };

    // Determine if this is "add" mode (no existing description)
    const isAddMode = !currentValue;

    const tooltipContent = !isEditable
        ? getEditDisabledMessage(reason)
        : isAddMode
          ? "Add description"
          : "Edit description";

    return (
        <FernTooltipProvider delayDuration={300}>
            <FernTooltip content={tooltipContent} side="top" sideOffset={4}>
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={!isEditable}
                    className={cn(
                        "inline-flex items-center justify-center rounded p-1 transition-colors",
                        isEditable
                            ? "text-(color:--grayscale-a9) hover:text-(color:--accent-a11) hover:bg-(color:--accent-a3)"
                            : "text-(color:--grayscale-a6) cursor-not-allowed",
                        className
                    )}
                    aria-label={isEditable ? (isAddMode ? "Add description" : "Edit description") : tooltipContent}
                >
                    {isAddMode ? <Plus className="size-3.5" /> : <Pencil className="size-3.5" />}
                </button>
            </FernTooltip>
        </FernTooltipProvider>
    );
}
