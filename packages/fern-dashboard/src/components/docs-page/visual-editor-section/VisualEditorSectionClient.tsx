"use client";

import { createNavigationBufferedIndexedDBStorage } from "@fern-docs/components/navigation";
import { useEffect, useState } from "react";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getRelevantUserBranchesForSite } from "@/app/services/dal/mongodb/getRelevantUserBranchesForSite";
import type { GithubSourceRepo } from "@/app/services/github/types";
import Card from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocsUrl } from "@/utils/types";

import { BranchList } from "../BranchList";
import { GoToEditorButton } from "../GoToEditorButton";
import { VisualEditorEmptyCard } from "./VisualEditorEmptyCard";
import { VisualEditorHeader } from "./VisualEditorHeader";

export function VisualEditorSectionClient({
    maybeCriticalUpdateWarning,
    session,
    docsUrl,
    sourceRepo,
    orgName
}: {
    maybeCriticalUpdateWarning: React.ReactNode;
    session: Auth0SessionData;
    docsUrl: DocsUrl;
    sourceRepo?: GithubSourceRepo;
    orgName: Auth0OrgName;
}) {
    const [relevantBranches, setRelevantBranches] = useState<string[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(true);

    // Load relevant branches for user on this site and org
    useEffect(() => {
        setLoadingBranches(true);
        const getBranches = async () => {
            const storage = createNavigationBufferedIndexedDBStorage();
            await storage.init();
            const relevantBranches = storage.getAllStoredBranches();
            setRelevantBranches(relevantBranches);
            setLoadingBranches(false);
        };
        void getBranches();
    }, [session.user.sub, docsUrl, orgName]);

    // Loading state
    if (loadingBranches) {
        const loadingRow = (
            <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/3" />
            </div>
        );
        return (
            <Card className="flex flex-col">
                <VisualEditorHeader />
                <div className="flex flex-col gap-3">
                    {loadingRow}
                    <hr className="border-border" />
                    {loadingRow}
                    <hr className="border-border" />
                    {loadingRow}
                </div>
            </Card>
        );
    }

    if (relevantBranches.length > 0) {
        return (
            <BranchList
                maybeCriticalUpdateWarning={maybeCriticalUpdateWarning}
                docsUrl={docsUrl}
                session={session}
                sourceRepo={sourceRepo}
                branches={relevantBranches}
            />
        );
    }

    return (
        <VisualEditorEmptyCard>
            <>
                {maybeCriticalUpdateWarning}
                <div className="flex flex-col gap-2 sm:flex-row">
                    <GoToEditorButton docsUrl={docsUrl} session={session} />
                </div>
            </>
        </VisualEditorEmptyCard>
    );
}
