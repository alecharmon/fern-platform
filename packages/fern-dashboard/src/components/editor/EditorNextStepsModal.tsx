"use client";

import { ExternalLinkIcon, Rocket } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfetti } from "@/hooks/useConfetti";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrStatus } from "@/providers/GitPRContext";
import { Button } from "../ui/button";
import { CopyableText } from "../ui/CopyableText";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { Step, Steps } from "../ui/steps";
import { MarkAsReadyButton } from "./git/MarkAsReadyButton";

export interface EditorNextStepsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditorNextStepsModal({ open, onOpenChange }: EditorNextStepsModalProps) {
    const [showConfetti, setShowConfetti] = useState(true);
    const { gitPrUrl, isReadyForReview } = useGitPrStatus();
    const { gitUrl } = useGitHubRepo();
    const { startConfetti } = useConfetti();

    // Determine provider from repoUrl
    const isGitLab = useMemo(() => gitUrl?.includes("gitlab.com"), [gitUrl]);
    const providerName = isGitLab ? "GitLab" : "GitHub";

    // Trigger confetti when modal opens and showConfetti is set to true
    useEffect(() => {
        if (open && showConfetti) {
            startConfetti();
            setShowConfetti(false); // Only show confetti once
        }
    }, [open, showConfetti, startConfetti]);

    const handleOpenPr = useCallback(() => {
        if (gitPrUrl) {
            window.open(gitPrUrl, "_blank", "noopener,noreferrer");
        }
    }, [gitPrUrl]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl flex items-center justify-center gap-2">
                        <Rocket className="size-6 text-primary" />
                        What's next?
                    </DialogTitle>
                </DialogHeader>
                <DialogBody className="px-6 pl-8 py-6">
                    <Steps>
                        <Step number={1} title="Done making changes?" completed={isReadyForReview}>
                            <MarkAsReadyButton />
                        </Step>

                        <Step number={2} title={`Send your ${providerName} link to your team for review!`}>
                            {gitPrUrl ? (
                                <div className="flex items-center space-x-2">
                                    <CopyableText
                                        text={gitPrUrl}
                                        variant="innerCopy"
                                        successMessage="URL copied to clipboard!"
                                        wrapperClassName="flex-1"
                                    />
                                    <Button variant="outline" onClick={handleOpenPr}>
                                        <ExternalLinkIcon className="size-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Skeleton className="h-10 w-full" />
                            )}
                        </Step>
                    </Steps>
                </DialogBody>
                <DialogFooter className="justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
