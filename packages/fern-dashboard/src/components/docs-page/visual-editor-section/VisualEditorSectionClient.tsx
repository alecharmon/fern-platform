"use client";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { GithubSourceRepo } from "@/app/services/github/types";
import Card from "@/components/ui/card";
import { useLocalBranches } from "@/hooks/useLocalBranches";
import { useLocalBranchesForSite } from "@/hooks/useLocalBranchesForSite";
import type { DocsUrl } from "@/utils/types";
import { BranchList } from "../BranchList";
import { GoToEditorButton } from "../GoToEditorButton";
import { VisualEditorEmptyCard } from "./VisualEditorEmptyCard";
import { VisualEditorHeader } from "./VisualEditorHeader";
import { VisualEditorLoadingCard } from "./VisualEditorLoadingCard";

export function VisualEditorSectionClient({
    maybeCriticalUpdateWarning,
    session,
    docsUrl,
    sourceRepo
}: {
    maybeCriticalUpdateWarning: React.ReactNode;
    session: Auth0SessionData;
    docsUrl: DocsUrl;
    sourceRepo?: GithubSourceRepo;
}) {
    const { loading } = useLocalBranches();
    const { filteredBranches } = useLocalBranchesForSite(docsUrl);

    return (
        <>
            {loading ? (
                <VisualEditorLoadingCard />
            ) : (
                <>
                    {filteredBranches.length === 0 ? (
                        <VisualEditorEmptyCard>
                            <>
                                {maybeCriticalUpdateWarning}
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <GoToEditorButton docsUrl={docsUrl} session={session} />
                                </div>
                            </>
                        </VisualEditorEmptyCard>
                    ) : (
                        <Card className="flex flex-col">
                            {maybeCriticalUpdateWarning}
                            <div className="flex items-center justify-between">
                                <VisualEditorHeader />
                                <GoToEditorButton docsUrl={docsUrl} session={session} />
                            </div>
                            <BranchList docsUrl={docsUrl} sourceRepo={sourceRepo} />
                        </Card>
                    )}
                </>
            )}
        </>
    );
}
