import "server-only";

import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsUrl } from "@/utils/types";

import { GithubAuthState } from "../GithubSource";
import { CriticalUpdateWarning } from "./CriticalUpdateWarning";
import { VisualEditorEmptyCard } from "./VisualEditorEmptyCard";
import { VisualEditorSectionClient } from "./VisualEditorSectionClient";
import { VisualEditorValidationErrorHandler } from "./VisualEditorValidationErrorHandler";

export async function VisualEditorSection({
  docsUrl,
  session,
  githubAuthState,
  githubUrl,
  orgName,
}: {
  docsUrl: DocsUrl;
  session: Auth0SessionData;
  githubAuthState: GithubAuthState;
  githubUrl?: string;
  orgName: Auth0OrgName;
}) {
  if (!githubAuthState.validationResult.ok) {
    return (
      <VisualEditorEmptyCard>
        <VisualEditorValidationErrorHandler
          error={githubAuthState.validationResult.error}
          githubUrl={githubUrl}
          orgName={orgName}
          site={docsUrl}
        />
      </VisualEditorEmptyCard>
    );
  }
  const baseBranch = githubAuthState.sourceRepo?.baseBranch;

  // This should never happen because this would be caught by the validation handler above, but added to mitigate type errors
  if (githubUrl == null || baseBranch == null) {
    return (
      <VisualEditorEmptyCard>
        <VisualEditorValidationErrorHandler
          error={{
            type: "UNEXPECTED_ERROR",
            message: "Github URL or base branch is was not found.",
          }}
          githubUrl={githubUrl}
          orgName={orgName}
          site={docsUrl}
        />
      </VisualEditorEmptyCard>
    );
  }

  return (
    <VisualEditorSectionClient
      maybeCriticalUpdateWarning={
        <CriticalUpdateWarning
          orgName={orgName}
          docsUrl={docsUrl}
          githubUrl={githubUrl}
          baseBranch={baseBranch}
        />
      }
      orgName={orgName}
      session={session}
      docsUrl={docsUrl}
      sourceRepo={githubAuthState.sourceRepo}
    />
  );
}
