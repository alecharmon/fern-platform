import { toast } from "sonner";

/**
 * This file contains reusable toasts that are used in the editor.
 */

export function SuccessfulCommitToast(prUrl?: string) {
    if (prUrl) {
        return toast.success(
            <div className="flex items-center gap-2">
                <span>Successfully committed changes!</span>
                <a
                    href={prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                >
                    View PR
                </a>
            </div>
        );
    }
    return toast.success("Successfully committed changes!");
}

export function SuccessfulEditSourceToast() {
    return toast.success("Successfully linked your repository!");
}

export function ErrorInvalidGithubUrlToast() {
    return toast.error("Invalid GitHub URL. Please update and try again.");
}

export function ErrorEditSourceToast() {
    return toast.error("Failed to link your repository. Please try again.");
}

export function ErrorFullCommitToast() {
    toast.error("Failed to commit changes. Please try again.");
}

export function ErrorNoGithubSourceToast() {
    toast.error("No github source found. Please ensure you have connected your repository.");
}

export function ErrorNoBaseBranchToast() {
    toast.error("No base branch found. Please set a base branch on your repository and reconnect.");
}

export function ErrorNoBranchToast() {
    toast.error("No branch found. Please ensure the working branch is not deleted.");
}

export function WarningNoChangesToast() {
    toast.warning("No changes to commit!");
}

export function ErrorStillSyncingToast() {
    toast.error("Your changes are still syncing. Please try again.");
}

export function ErrorCreateBranchToast() {
    toast.error("Failed to create branch. Please try again.");
}

export function WarningValidationToast(validationError: string) {
    toast.warning("Markdown validation failed: " + validationError);
}

export function ErrorUpdatePrTitleToast() {
    toast.error("Failed to update PR title. Please try again.");
}

export function ErrorUpdatePrStatusToast() {
    toast.error("Failed to update PR status. Please try again.");
}

export function ErrorUploadMediaToast(error: Error) {
    toast.error("Unable to upload media: " + error.message);
}

export function UploadingMediaToast() {
    toast.info("Uploading media...");
}

export function SuccessfulUploadMediaToast() {
    toast.success("Media uploaded successfully!");
}

export function ErrorUpgradeFernCliVersionToast(error: string = "") {
    toast.error("Failed to upgrade Fern CLI version. Please try again. " + error);
}

export function PageDeletedUndoToast(pageTitle: string, onUndo: () => void) {
    return toast.success(`Page "${pageTitle}" deleted from site`, {
        action: {
            label: "Undo",
            onClick: onUndo
        },
        duration: 8000 // Show for 8 seconds to give user time to undo
    });
}
