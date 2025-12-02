"use client";

import { useCallback, useState } from "react";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { getOwnerAndRepoFromGithubUrl, normalizeGithubUrl } from "@/app/services/github/github";
import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocsUrl } from "@/utils/types";
import { ErrorEditSourceToast, ErrorInvalidGithubUrlToast } from "../../../editor/EditorToasts";
import { GithubRepoInput } from "../../GithubRepoInput";

interface ConnectGithubContentProps {
    docsUrl: DocsUrl;
    onRepoConnected: (hasAppInstalled: boolean, githubUrl?: string) => void;
    connectRepo: (params: { canonicalUrl: string }) => Promise<{ success: boolean; githubUrl: string | undefined }>;
}

export function ConnectGithubContent({ docsUrl, onRepoConnected, connectRepo }: ConnectGithubContentProps) {
    const [phase, setPhase] = useState<"idle" | "checking" | "saving">("idle");
    const isSaving = phase !== "idle";
    const statusLabel = phase === "checking" ? "Checking..." : phase === "saving" ? "Connecting..." : "Connect";

    const handleConnectRepo = useCallback(
        async (canonicalUrl: string) => {
            const normalized = normalizeGithubUrl(canonicalUrl);
            if (!normalized.isValidShape || !normalized.canonicalUrl) {
                ErrorInvalidGithubUrlToast();
                return;
            }

            const { owner, repo } = getOwnerAndRepoFromGithubUrl(normalized.canonicalUrl);
            if (!owner || !repo) {
                ErrorInvalidGithubUrlToast();
                return;
            }

            setPhase("checking");
            try {
                const validation = await DashboardApiClient.validateGithubRepoAccess({
                    url: docsUrl,
                    owner,
                    repo
                });

                if (!validation?.appInstalled) {
                    onRepoConnected(false, normalized.canonicalUrl);
                    return;
                }

                if (!validation.ok) {
                    onRepoConnected(true, normalized.canonicalUrl);
                    return;
                }

                setPhase("saving");
                await connectRepo({ canonicalUrl: normalized.canonicalUrl });
                onRepoConnected(true, normalized.canonicalUrl);
            } catch (error) {
                console.error("Failed to validate or connect repo", error);
                ErrorEditSourceToast();
            } finally {
                setPhase("idle");
            }
        },
        [docsUrl, onRepoConnected, connectRepo]
    );

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex gap-2 text-primary items-center">Connect your repository</DialogTitle>
                <DialogDescription>
                    Editing made easy. Link your repository to your Fern site to enable your team to create pull
                    requests from the Fern Editor.
                </DialogDescription>
            </DialogHeader>
            <DialogBody>
                <GithubRepoInput
                    docsUrl={docsUrl}
                    onSave={handleConnectRepo}
                    saveButtonText={statusLabel}
                    autoFocus
                    validationType="simple"
                    disabled={isSaving}
                />
            </DialogBody>
        </>
    );
}
