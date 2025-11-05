"use client";

import type { ReactNode } from "react";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { GithubRepoValidationError } from "@/app/services/dal/github/validators";
import type { GithubSourceRepo } from "@/app/services/github/types";
import type { DocsUrl } from "@/utils/types";
import { BranchList } from "../BranchList";
import { GoToEditorButton } from "../GoToEditorButton";
import { VEPreviewImage } from "../VEPreviewImage";
import { VisualEditorCard } from "./VisualEditorCard";
import { VisualEditorValidationErrorHandler } from "./VisualEditorValidationErrorHandler";

// Errors that show a compact warning in the header with VEPreviewImage below
const HEADER_WARNING_ERRORS: Set<GithubRepoValidationError["type"]> = new Set([
    "REPO_NOT_CONNECTED",
    "FERN_BOT_NOT_INSTALLED",
    "FERN_CONFIG_JSON_ORG_MISMATCH",
    "MULTIPLE_PROJECTS_WITH_SITE"
]);

export function VisualEditorContent({
    docsUrl,
    session,
    orgName,
    githubUrl,
    error,
    sourceRepo,
    criticalUpdateWarning
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    orgName: Auth0OrgName;
    githubUrl?: string;
    error?: GithubRepoValidationError;
    sourceRepo?: GithubSourceRepo;
    criticalUpdateWarning?: ReactNode;
}) {
    // If there's an error, determine how to display it
    if (error) {
        // Show warning in header with preview image below
        return (
            <VisualEditorCard
                rightContent={
                    <VisualEditorValidationErrorHandler
                        error={error}
                        githubUrl={githubUrl}
                        orgName={orgName}
                        docsUrl={docsUrl}
                    />
                }
            >
                <VEPreviewImage />
            </VisualEditorCard>
        );
    }

    // Validation passed! Show the card with the Go to Editor button
    return (
        <VisualEditorCard rightContent={<GoToEditorButton docsUrl={docsUrl} session={session} />}>
            {criticalUpdateWarning}
            <BranchList docsUrl={docsUrl} sourceRepo={sourceRepo} />
        </VisualEditorCard>
    );
}
