import "server-only";

import { ThemeProvider } from "next-themes";
import type React from "react";
import { ClientMDXProvider } from "@/app/[orgName]/context/ClientMDXProvider";
import { OrgNameProvider } from "@/app/[orgName]/context/OrgNameContext";
import { getGithubSourceMetadata } from "@/app/actions/getGithubSourceMetadata";
import { getGitlabSourceMetadata } from "@/app/actions/getGitlabSourceMetadata";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGitUrl } from "@/app/services/dal/git/assertAuthAndFetchGitUrl";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { BranchInitializer } from "@/components/editor/BranchInitializer";
import { ClientNavigationProvider } from "@/components/editor/ClientNavigationProvider";
import { HeaderToolbar } from "@/components/editor/HeaderToolbar";
import { PreviewOnlyNotification } from "@/components/editor/PreviewOnlyNotification";
import { BranchProvider } from "@/providers/BranchContext";
import { CurrentPageProvider } from "@/providers/CurrentPageContext";
import { DevModeProvider } from "@/providers/DevModeProvider";
import { EditorProvider } from "@/providers/EditorContext";
import { GitHubRepoProvider } from "@/providers/GitHubRepoContext";
import { GitPRProvider } from "@/providers/GitPRContext";
import { throwDigestibleError } from "@/utils/errors";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

function EditorShell({ children }: { children: React.ReactNode }) {
    return <div className="flex w-full flex-col overflow-hidden">{children}</div>;
}

export default async function EditorLayout({
    params,
    children
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

    await getAuthenticatedSessionOrRedirect(orgName);

    const { gitUrl, session } = await assertAuthAndFetchGitUrl(orgName, docsUrl);

    // Determine provider and fetch appropriate metadata
    const parsed = parseGitUrl(gitUrl);
    const isGitLab = parsed.provider === "gitlab";

    const sourceRepo = isGitLab
        ? await getGitlabSourceMetadata({
              gitlabUrl: gitUrl,
              userId: session.user.sub
          })
        : await getGithubSourceMetadata({
              gitUrl,
              userId: session.user.sub
          });

    if (sourceRepo.owner == null || sourceRepo.repo == null || sourceRepo.baseBranch == null) {
        throw throwDigestibleError(new Error("Source repo is not set"), "REPO_NOT_CONNECTED");
    }

    // Use the factory function to get the appropriate loader (GitHub or GitLab)
    const gitLoader = getGitLoader(gitUrl);

    // Load docs.yml from the base branch (since the editing branch might not exist yet)
    const docsYmlAndReferences = await gitLoader.getDocsYmlAndReferences(
        sourceRepo.owner,
        sourceRepo.repo,
        docsUrl,
        sourceRepo.baseBranch // Use base branch to load initial content
    );
    const latestDocsYmlAndReferences = docsYmlAndReferences.type === "ok" ? docsYmlAndReferences.result : null;
    const fernFolderPath =
        docsYmlAndReferences.type === "ok" ? docsYmlAndReferences.metadata.fernFolderPath : undefined;

    if (docsYmlAndReferences.type !== "ok") {
        console.error(docsYmlAndReferences.error);
    }

    return (
        <EditorShell>
            <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
                <OrgNameProvider orgName={orgName}>
                    <BranchProvider branch={branch}>
                        <GitHubRepoProvider branch={branch} sourceRepo={sourceRepo} docsUrl={docsUrl} gitUrl={gitUrl}>
                            <BranchInitializer
                                orgName={orgName}
                                site={docsUrl}
                                owner={sourceRepo.owner}
                                repo={sourceRepo.repo}
                                branch={branch}
                                baseBranch={sourceRepo.baseBranch}
                                gitUrl={gitUrl}
                            />
                            <ClientNavigationProvider
                                branchName={branch}
                                orgName={orgName}
                                docsUrl={docsUrl}
                                latestDocsYmlAndReferences={latestDocsYmlAndReferences}
                                fernFolderPath={fernFolderPath}
                            >
                                <CurrentPageProvider>
                                    <ClientMDXProvider>
                                        <DevModeProvider>
                                            <EditorProvider>
                                                <GitPRProvider
                                                    owner={sourceRepo.owner}
                                                    repo={sourceRepo.repo}
                                                    baseBranch={sourceRepo.baseBranch}
                                                    branch={branch}
                                                    site={docsUrl}
                                                    gitUrl={gitUrl}
                                                >
                                                    <HeaderToolbar session={session} docsUrl={docsUrl} />
                                                    <PreviewOnlyNotification />
                                                    {children}
                                                </GitPRProvider>
                                            </EditorProvider>
                                        </DevModeProvider>
                                    </ClientMDXProvider>
                                </CurrentPageProvider>
                            </ClientNavigationProvider>
                        </GitHubRepoProvider>
                    </BranchProvider>
                </OrgNameProvider>
            </ThemeProvider>
        </EditorShell>
    );
}
