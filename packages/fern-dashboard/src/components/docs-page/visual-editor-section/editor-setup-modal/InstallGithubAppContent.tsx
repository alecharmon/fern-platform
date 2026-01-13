"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { GitRepoAccessCheckResult } from "@/app/api/validate-git-repo/handler";
import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ConnectGitRepoParams } from "@/hooks/useConnectGitRepo";

import { Button } from "../../../ui/button";

interface InstallGithubAppContentProps {
    pendingGithubUrl: string;
    accessCheckResult?: GitRepoAccessCheckResult | null;
    isCheckingAccess: boolean;
    onAppInstalled: () => void;
    connectRepo: (params: ConnectGitRepoParams) => Promise<{ success: boolean; gitUrl: string | undefined }>;
}

export function InstallGithubAppContent({
    pendingGithubUrl,
    accessCheckResult,
    isCheckingAccess,
    onAppInstalled,
    connectRepo
}: InstallGithubAppContentProps) {
    const [isSaving, setIsSaving] = useState(false);
    const hasSavedRef = useRef(false);

    // Check if app is installed - this can be true even if full validation fails
    const isAppInstalled = accessCheckResult?.appInstalled === true || accessCheckResult?.ok;
    const isFullyValid = accessCheckResult?.ok === true;

    // When app is detected as installed, handle next step
    const handleAppInstalled = useCallback(async () => {
        // Always advance the state machine so VALIDATION_SUCCESS can complete the flow
        onAppInstalled();

        // If we have a pending URL and everything is valid, save it now using the centralized hook
        if (!pendingGithubUrl || !isFullyValid) {
            return;
        }

        if (hasSavedRef.current) {
            return;
        }
        hasSavedRef.current = true;
        setIsSaving(true);
        await connectRepo({ canonicalUrl: pendingGithubUrl })
            .then(({ success }) => {
                if (!success) {
                    hasSavedRef.current = false;
                }
            })
            .finally(() => {
                setIsSaving(false);
            });
        // The connectRepo will call onSuccess which triggers handleValidationSuccess
        // in the parent, which will eventually show confetti and transition to SUCCESS
    }, [pendingGithubUrl, isFullyValid, connectRepo, onAppInstalled]);

    useEffect(() => {
        if (isAppInstalled && !isSaving && !isCheckingAccess) {
            void handleAppInstalled();
        }
    }, [isAppInstalled, isSaving, isCheckingAccess, handleAppInstalled]);

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-primary flex items-center gap-2">Install the Fern GitHub App</DialogTitle>
                <DialogDescription className="mb-3">
                    Please grant Fern access to this repo and come back to this screen.
                </DialogDescription>
            </DialogHeader>
            <DialogBody>
                <Button variant="default" asChild>
                    <Link
                        href="https://github.com/apps/fern-api/installations/new"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Install GitHub App
                        <ArrowUpRightIcon className="size-4" />
                    </Link>
                </Button>
            </DialogBody>
        </>
    );
}
