"use client";

import { useEffect, useState } from "react";

import { createNavigationLocalStorage } from "@fern-docs/components";
import { getRelevantBranchesForUser } from "@fern-docs/components/navigation/local-storage";

import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { GithubSourceRepo } from "@/app/services/github/types";
import Card from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DocsUrl } from "@/utils/types";

import { GoToEditorButton } from "../GoToEditorButton";
import { OpenPRsComponent } from "../OpenPRsComponent";
import { VisualEditorEmptyCard } from "./VisualEditorEmptyCard";
import { VisualEditorHeader } from "./VisualEditorHeader";

export function VisualEditorSectionClient({
  maybeCriticalUpdateWarning,
  session,
  docsUrl,
  sourceRepo,
}: {
  maybeCriticalUpdateWarning: React.ReactNode;
  session: Auth0SessionData;
  docsUrl: DocsUrl;
  sourceRepo?: GithubSourceRepo;
}) {
  const [relevantBranches, setRelevantBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // We load the relevant using a useEffect so that we can show a loading state. Without a loading state,
  // the server parent will not render a loading state, but an empty state.
  useEffect(() => {
    setLoadingBranches(true);
    const relevantBranches = getRelevantBranchesForUser(
      session.user.sub,
      createNavigationLocalStorage().getAllStoredBranches()
    );
    setRelevantBranches(relevantBranches);
    setLoadingBranches(false);
  }, [session.user.sub]);

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
          <hr />
          {loadingRow}
          <hr />
          {loadingRow}
        </div>
      </Card>
    );
  }

  if (relevantBranches.length > 0) {
    return (
      <OpenPRsComponent
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
          <GoToEditorButton
            docsUrl={docsUrl}
            session={session}
            sourceRepo={sourceRepo}
          />
        </div>
      </>
    </VisualEditorEmptyCard>
  );
}
