"use client";

import { Loader2, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ValidateGithubRepoAccessResponse } from "@/app/api/validate-github-repo-access/handler";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ConnectGitRepoParams } from "@/hooks/useConnectGitRepo";
import { Note } from "../../Note";
import { VisualEditorValidationErrorHandler } from "../VisualEditorValidationErrorHandler";

interface ConfigurationCheckContentProps {
    onValidationError: () => void;
    pendingGithubUrl: string;
    accessCheckResult?: ValidateGithubRepoAccessResponse | null;
    isCheckingAccess: boolean;
    refetchAccessCheck: () => Promise<unknown>;
    connectRepo: (params: ConnectGitRepoParams) => Promise<{ success: boolean; gitUrl: string | undefined }>;
}

export function ConfigurationCheckContent({
    onValidationError,
    pendingGithubUrl,
    connectRepo,
    accessCheckResult,
    isCheckingAccess,
    refetchAccessCheck
}: ConfigurationCheckContentProps) {
    const [isRetrying, setIsRetrying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const hasSavedRef = useRef(false);

    const handleRetryValidation = useCallback(() => {
        setIsRetrying(true);
        void refetchAccessCheck().finally(() => {
            setIsRetrying(false);
        });
    }, [refetchAccessCheck]);

    // Automatically notify parent of validation state
    // AND save the GitHub URL when validation succeeds
    useEffect(() => {
        if (!accessCheckResult || isCheckingAccess) {
            return;
        }

        if (accessCheckResult.ok && !hasSavedRef.current && !isSaving) {
            hasSavedRef.current = true;
            setIsSaving(true);

            void connectRepo({ canonicalUrl: pendingGithubUrl })
                .then(({ success }) => {
                    if (!success) {
                        hasSavedRef.current = false;
                    }
                })
                .finally(() => {
                    setIsSaving(false);
                });
        } else if (!accessCheckResult.ok) {
            onValidationError();
            hasSavedRef.current = false;
        }
    }, [accessCheckResult, connectRepo, pendingGithubUrl, onValidationError, isSaving, isCheckingAccess]);

    // If still validating or saving, or if validation succeeded and we're waiting for state transition
    // Note: We don't render SuccessContent here - we let the parent component handle that
    // when the state machine reaches "SUCCESS" state
    if (!accessCheckResult || isSaving || accessCheckResult.ok) {
        return (
            <>
                <DialogHeader>
                    <DialogTitle className="flex gap-2 text-primary items-center">Configuration check</DialogTitle>
                    <DialogDescription>
                        {isSaving
                            ? "Saving your repository connection..."
                            : "Validating your repository configuration..."}
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <div className="flex items-center justify-center gap-3 py-8">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span className="text-muted-foreground text-sm">
                            {isSaving ? "Saving connection..." : "Loading..."}
                        </span>
                    </div>
                </DialogBody>
            </>
        );
    }

    const error = accessCheckResult.error ?? {
        type: "UNEXPECTED_ERROR" as const,
        message: "Unknown validation error"
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex gap-2 text-primary items-center">Last step!</DialogTitle>
                <DialogDescription>
                    In order to finish connecting your repository, we need to validate that your repository matches your
                    Fern site.
                </DialogDescription>
            </DialogHeader>
            <DialogBody>
                <div className="flex flex-col gap-4">
                    <Note className="max-h-[200px] overflow-y-auto">
                        <VisualEditorValidationErrorHandler error={error} githubUrl={pendingGithubUrl} />
                    </Note>
                    <Button variant="default" onClick={handleRetryValidation} loading={isCheckingAccess || isRetrying}>
                        <RotateCcwIcon className="size-4" />
                        Fixed, please revalidate!
                    </Button>
                </div>
            </DialogBody>
        </>
    );
}
