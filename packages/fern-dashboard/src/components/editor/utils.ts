import type { Transaction } from "@tiptap/pm/state";

/**
 * Checks if content was added or removed in a TipTap transaction by:
 * - Examining the transaction steps
 * - Comparing position ranges to detect content changes
 */
export function hasChangedContentInTransaction(transaction: Transaction): boolean {
    return (
        transaction.docChanged &&
        transaction.steps.some((step) => {
            // Check if this is a content replacement step
            if (step && "getMap" in step && typeof step.getMap === "function") {
                const map = step.getMap();
                let contentChanged = false;
                map.forEach((oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
                    // If the range sizes are different, content was added or removed
                    if (newEnd - newStart !== oldEnd - oldStart) {
                        contentChanged = true;
                    }
                });
                return contentChanged;
            }
            return false;
        })
    );
}
