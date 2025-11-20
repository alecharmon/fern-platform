"use client";

import { Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfetti } from "@/hooks/useConfetti";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { Button } from "../ui/button";
import { CopyableText } from "../ui/CopyableText";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { Step, Steps } from "../ui/steps";
import { MarkAsReadyButton } from "./MarkAsReadyButton";

export interface EditorNextStepsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditorNextStepsModal({ open, onOpenChange }: EditorNextStepsModalProps) {
    const [showConfetti, setShowConfetti] = useState(true);
    const { gitPrUrl, isReadyForReview } = useGitPrInfo();
    const { startConfetti } = useConfetti();

    // Trigger confetti when modal opens and showConfetti is set to true
    useEffect(() => {
        if (open && showConfetti) {
            startConfetti();
            setShowConfetti(false); // Only show confetti once
        }
    }, [open, showConfetti, startConfetti]);

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

                        <Step number={2} title="Send your GitHub link to your team for review!">
                            {gitPrUrl ? (
                                <CopyableText text={gitPrUrl} successMessage="URL copied to clipboard!" />
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
