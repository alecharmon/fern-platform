"use client";

import type { ReactNode } from "react";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { GitRepoValidationError } from "@/app/services/dal/git/validators";
import type { GithubSourceRepo } from "@/app/services/github/types";
import type { DocsUrl } from "@/utils/types";
import { BranchList } from "../BranchList";
import { ConnectGithubRepoButton } from "../ConnectGithubRepoButton";
import { GoToEditorButton } from "../GoToEditorButton";
import { InstallGithubAppButton } from "../InstallGithubAppButton";
import { VEPreviewImage } from "../VEPreviewImage";
import { VisualEditorCard } from "./VisualEditorCard";
import { VisualEditorValidationErrorHandler } from "./VisualEditorValidationErrorHandler";

export function VisualEditorContent({
    docsUrl,
    session,
    orgName,
    gitUrl,
    error,
    sourceRepo,
    criticalUpdateWarning
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    orgName: Auth0OrgName;
    gitUrl?: string;
    error?: GitRepoValidationError;
    sourceRepo?: GithubSourceRepo;
    criticalUpdateWarning?: ReactNode;
}) {
    const rightContent: ReactNode =
        error?.type === "REPO_NOT_CONNECTED" ? (
            // If repo is not connected, show connect repo button
            <ConnectGithubRepoButton docsUrl={docsUrl} variant="default" size="default" />
        ) : error?.type === "FERN_BOT_NOT_INSTALLED" ? (
            // If fern bot is not installed, show install fern bot button
            <InstallGithubAppButton docsUrl={docsUrl} gitUrl={gitUrl} orgName={orgName} />
        ) : (
            // Else, show editor button – should be disabled for all errors
            <GoToEditorButton docsUrl={docsUrl} session={session} disabled={!!error} />
        );

    return (
        <VisualEditorCard
            rightContent={rightContent}
            warningContent={
                // Don't show warning note for specific errors
                error && error.type !== "REPO_NOT_CONNECTED" && error.type !== "FERN_BOT_NOT_INSTALLED" ? (
                    <VisualEditorValidationErrorHandler
                        error={error}
                        gitUrl={gitUrl}
                        orgName={orgName}
                        docsUrl={docsUrl}
                    />
                ) : null
            }
        >
            {error ? (
                // When there's an error, show preview image
                <VEPreviewImage />
            ) : (
                <>
                    {criticalUpdateWarning}
                    <BranchList docsUrl={docsUrl} sourceRepo={sourceRepo} />
                </>
            )}
        </VisualEditorCard>
    );
}
