"use client";

import { GitMerge, GitPullRequestClosed } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { openFernEditor } from "@/app/actions/openFernEditor";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrStatus } from "@/providers/GitPRContext";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

/**
 * Modal that appears when the PR associated with the current editor session
 * has been merged or closed externally (e.g., on GitHub).
 *
 * Offers the user two options:
 * - Preview the current session (read-only)
 * - Start a new editor session (generates a new branch)
 */
export function PrStatusChangedModal() {
    const { prStatusTransition, clearPrStatusTransition } = useGitPrStatus();
    const { docsUrl } = useGitHubRepo();
    const orgName = useOrgName();
    const params = useParams();
    const [isStartingNewSession, setIsStartingNewSession] = useState(false);

    const [open, setOpen] = useState(false);

    // Show the modal when a PR status transition is detected
    useEffect(() => {
        if (prStatusTransition != null) {
            setOpen(true);
        }
    }, [prStatusTransition]);

    const currentSlug = params?.slug ? (Array.isArray(params.slug) ? params.slug.join("/") : params.slug) : "";

    const isMerged = prStatusTransition?.currentStatus === "merged";
    const StatusIcon = isMerged ? GitMerge : GitPullRequestClosed;

    const handlePreviewSession = useCallback(() => {
        setOpen(false);
        clearPrStatusTransition();
    }, [clearPrStatusTransition]);

    const handleStartNewSession = useCallback(async () => {
        setIsStartingNewSession(true);
        try {
            await openFernEditor({
                orgName,
                docsUrl,
                slug: currentSlug
            });
        } catch (error) {
            console.error("[PrStatusChangedModal] Error starting new session:", error);
            setIsStartingNewSession(false);
        }
    }, [orgName, docsUrl, currentSlug]);

    if (prStatusTransition == null) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    handlePreviewSession();
                }
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
                        <StatusIcon className={`size-5 ${isMerged ? "text-purple-800" : "text-red-600"}`} />
                        {isMerged ? "This session has been merged!" : "This PR has been closed"}
                    </DialogTitle>
                </DialogHeader>
                <DialogBody className="px-6 py-2">
                    <p className="text-muted-foreground text-sm text-center">
                        {isMerged
                            ? "Your changes have been merged. Would you like to start a new editor session?"
                            : "This PR was closed. Would you like to start a new editor session?"}
                    </p>
                </DialogBody>
                <DialogFooter>
                    <Button variant="outline" onClick={handlePreviewSession} disabled={isStartingNewSession}>
                        No, I'd like to preview this session
                    </Button>
                    <Button onClick={() => void handleStartNewSession()} loading={isStartingNewSession}>
                        Yes, start new session
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
