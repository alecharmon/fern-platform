import { ThemeProvider } from "next-themes";
import { redirect } from "next/navigation";
import type React from "react";

import getDocsGithubSourceHandler from "@/app/api/get-docs-github-source/handler";
import {
  Auth0SessionData,
  getCurrentSession,
} from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { GithubExtendedAccessProtectedRoute } from "@/components/auth/GithubExtendedAccessProtectedRoute";
import { HeaderToolbar } from "@/components/editor/HeaderToolbar";
import { BranchProvider } from "@/providers/BranchContext";
import { DevModeProvider } from "@/providers/DevModeProvider";
import { GitPRUrlProvider } from "@/providers/GitPRUrlContext";
import { MdxStateProvider } from "@/providers/MdxStateContext";
import { throwDigestibleError } from "@/utils/errors";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";

export const experimental_ppr = true;

// Static shell that renders immediately
function EditorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background noise flex w-full flex-col overflow-hidden">
      {children}
    </div>
  );
}

// Only the dynamic parts that need data fetching
async function DynamicEditorContent({
  orgName,
  docsUrl,
  branch,
  session,
  children,
}: {
  orgName: Auth0OrgName;
  docsUrl: DocsUrl;
  branch: string;
  session: Auth0SessionData;
  children: React.JSX.Element;
}) {
  const sourceRepo = await getDocsGithubSourceHandler({
    url: docsUrl,
    token: session.accessToken,
    userId: session.user.sub,
    orgName,
  });

  if (sourceRepo.owner == null || sourceRepo.repo == null) {
    throwDigestibleError(
      "We were unable to find the source repo for this domain. Please confirm that you have linked a repo to this domain.",
      "SOURCE_REPO_NOT_FOUND"
    );
  }

  if (sourceRepo.baseBranch == null) {
    throwDigestibleError(
      "Looks like your source repo is not configured correctly. Please set a base branch on your Github repo.",
      "BASE_BRANCH_NOT_SET"
    );
  }

  return (
    <GithubExtendedAccessProtectedRoute
      orgName={orgName}
      owner={sourceRepo.owner}
      repo={sourceRepo.repo}
    >
      <ThemeProvider
        attribute="class"
        forcedTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <DevModeProvider>
          <MdxStateProvider docsUrl={docsUrl}>
            <BranchProvider branch={branch}>
              <GitPRUrlProvider>
                <HeaderToolbar
                  orgName={orgName}
                  session={session}
                  docsUrl={docsUrl}
                />
                {children}
              </GitPRUrlProvider>
            </BranchProvider>
          </MdxStateProvider>
        </DevModeProvider>
      </ThemeProvider>
    </GithubExtendedAccessProtectedRoute>
  );
}

export default async function EditorLayout({
  params,
  children,
}: Readonly<{
  params: Promise<{
    orgName: Auth0OrgName;
    docsUrl: EncodedDocsUrl;
    branch: string;
  }>;
  children: React.JSX.Element;
}>) {
  const { orgName, docsUrl: encodedDocsUrl, branch } = await params;
  const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

  const session = await getCurrentSession();
  if (!session) {
    redirect("/");
  }

  return (
    <EditorShell>
      <DynamicEditorContent
        orgName={orgName}
        docsUrl={docsUrl}
        branch={branch}
        session={session}
      >
        {children}
      </DynamicEditorContent>
    </EditorShell>
  );
}
