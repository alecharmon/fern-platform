import { toast } from "sonner";
import type { PostGitCommitErrors } from "@/app/services/dal/github/postGitCommit";

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

export function SuccessfulEditSourceAndRefreshToast(refreshDelayInSeconds: number = 3) {
    return toast.success(
        `Successfully linked your repository! Page will automatically refresh in ${refreshDelayInSeconds} seconds.`
    );
}

export function ErrorEditSourceToast() {
    return toast.error("Failed to link your repository. Please try again.");
}

export function ErrorInvalidGithubUrlToast() {
    return toast.error("Invalid GitHub URL. Please update and try again.");
}

export function ErrorCommitToast(error?: PostGitCommitErrors) {
    if (!error) {
        return toast.error("Failed to commit changes due to unexpected error. Please try again.");
    }

    switch (error.type) {
        case "NOT_LOGGED_IN":
            return toast.error("You must be logged in to commit changes.");
        case "ORG_ACCESS_DENIED":
            return toast.error(`Organization access denied: ${error.message}`);
        case "BOT_NOT_INSTALLED":
            return toast.error("Fern bot is not installed on this repository. Please install it to commit changes.");
        case "CONFIG_ORG_MISMATCH":
            return toast.error(
                `Organization mismatch: expected ${error.expected}, but found ${error.actual} in fern.config.json`
            );
        case "CONFIG_MISSING":
            return toast.error("fern.config.json is missing from the repository.");
        case "CONFIG_MALFORMED":
            return toast.error(`fern.config.json is malformed: ${error.message}`);
        case "OPERATION_FAILED":
            return toast.error(`Operation failed: ${error.message}`);
        case "RESOURCE_NOT_FOUND":
            return toast.error(`Resource not found: ${error.message}`);
        case "RESOURCE_ALREADY_EXISTS":
            return toast.error(`Resource already exists: ${error.message}`);
        case "UNEXPECTED_ERROR":
        case "UNKNOWN_ERROR":
            return toast.error("Unexpected error. Please try again and contact support if the problem persists.");
        default:
            return toast.error("Failed to commit changes. Please try again.");
    }
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
