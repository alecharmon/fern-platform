"use client";

import type { GitSourceRepo } from "@/app/services/github/types";
import type { DocsHeaderUserInfo } from "@/components/docs-page/DocsHeaderClient";
import type { DocsUrl } from "@/utils/types";
import { BranchList } from "../BranchList";
import { GoToEditorButton } from "../GoToEditorButton";
import { VisualEditorCard } from "./VisualEditorCard";

export function VisualEditorContent({
    docsUrl,
    user,
    sourceRepo,
    buttonDisabled = false
}: {
    docsUrl: DocsUrl;
    user: DocsHeaderUserInfo;
    sourceRepo?: GitSourceRepo;
    buttonDisabled?: boolean;
}) {
    return (
        <VisualEditorCard rightContent={buttonDisabled ? null : <GoToEditorButton docsUrl={docsUrl} user={user} />}>
            <BranchList docsUrl={docsUrl} sourceRepo={sourceRepo} validationPassed={!buttonDisabled} />
        </VisualEditorCard>
    );
}
