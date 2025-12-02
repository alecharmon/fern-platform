"use client";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { GithubSourceRepo } from "@/app/services/github/types";
import type { DocsUrl } from "@/utils/types";
import { BranchList } from "../BranchList";
import { GoToEditorButton } from "../GoToEditorButton";
import { VisualEditorCard } from "./VisualEditorCard";

export function VisualEditorContent({
    docsUrl,
    session,
    sourceRepo,
    buttonDisabled = false
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    sourceRepo?: GithubSourceRepo;
    buttonDisabled?: boolean;
}) {
    return (
        <VisualEditorCard
            rightContent={buttonDisabled ? null : <GoToEditorButton docsUrl={docsUrl} session={session} />}
        >
            <BranchList docsUrl={docsUrl} sourceRepo={sourceRepo} validationPassed={!buttonDisabled} />
        </VisualEditorCard>
    );
}
