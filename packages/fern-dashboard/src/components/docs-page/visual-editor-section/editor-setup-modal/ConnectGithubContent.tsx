"use client";

import { useCallback, useState } from "react";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { normalizeGithubUrl } from "@/app/services/github/github";
import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocsUrl } from "@/utils/types";
import { ErrorEditSourceToast, ErrorInvalidGitUrlToast } from "../../../editor/EditorToasts";
import { GithubRepoInput } from "../../GithubRepoInput";

interface ConnectGithubContentProps {
    docsUrl: DocsUrl;
    onRepoConnected: (hasAppInstalled: boolean, githubUrl?: string) => void;
    connectRepo: (params: { canonicalUrl: string }) => Promise<{ success: boolean; gitUrl: string | undefined }>;
}

export function ConnectGithubContent({ docsUrl, onRepoConnected, connectRepo }: ConnectGithubContentProps) {
    const [phase, setPhase] = useState<"idle" | "checking" | "saving">("idle");
    const isSaving = phase !== "idle";
    const statusLabel = phase === "checking" ? "Checking..." : phase === "saving" ? "Connecting..." : "Connect";

    const handleConnectRepo = useCallback(
        async (canonicalUrl: string) => {
            const parsedUrl = parseGitUrl(canonicalUrl);
            const isGitHub = parsedUrl.provider === "github";
            const isGitLab = parsedUrl.provider === "gitlab";

            if (!isGitHub && !isGitLab) {
                ErrorInvalidGitUrlToast();
                return;
            }

            const normalized = isGitHub ? normalizeGithubUrl(canonicalUrl) : null;
            if (isGitHub && (!normalized?.isValidShape || !normalized?.canonicalUrl)) {
                ErrorInvalidGitUrlToast();
                return;
            }

            const owner = parsedUrl.owner;
            const repo = isGitHub ? (normalized?.repo ?? parsedUrl.repo) : parsedUrl.repo;

            if (!owner || !repo) {
                ErrorInvalidGitUrlToast();
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
                    onRepoConnected(false, canonicalUrl);
                    return;
                }

                if (!validation.ok) {
                    onRepoConnected(true, canonicalUrl);
                    return;
                }

                setPhase("saving");
                await connectRepo({ canonicalUrl: isGitHub ? (normalized?.canonicalUrl ?? "") : canonicalUrl });
                onRepoConnected(true, isGitHub ? (normalized?.canonicalUrl ?? "") : canonicalUrl);
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
