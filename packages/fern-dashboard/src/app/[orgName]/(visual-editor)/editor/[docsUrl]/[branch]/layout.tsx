import "server-only";

import { ThemeProvider } from "next-themes";
import type React from "react";

import { ClientMDXProvider } from "@/app/[orgName]/context/ClientMDXProvider";
import { OrgNameProvider } from "@/app/[orgName]/context/OrgNameContext";
import getGithubSourceMetadata from "@/app/api/get-github-source-metadata/handler";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { GitHubLoader } from "@/app/services/github/github-loader";
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

    const { githubUrl, session } = await assertAuthAndFetchGithubUrl({
        orgName,
        docsUrl
    });

    const sourceRepo = await getGithubSourceMetadata({
        githubUrl,
        userId: session.user.sub
    });

    if (sourceRepo.owner == null || sourceRepo.repo == null || sourceRepo.baseBranch == null) {
        throw throwDigestibleError(new Error("Source repo is not set"), "REPO_NOT_CONNECTED");
    }

    // TODO: lazy load this so we don't block the initial server render?
    const githubLoader = new GitHubLoader(githubUrl);

    // Use the repo's default branch by passing preferDefaultBranch=true
    const docsYmlResult = await githubLoader.getDocsYml(
        sourceRepo.owner,
        sourceRepo.repo,
        docsUrl,
        branch, // fallback branch if default branch logic fails
        true // preferDefaultBranch = true
    );
    const initialDocsYmlContent = docsYmlResult.type === "ok" ? docsYmlResult.result : null;

    if (docsYmlResult.type !== "ok") {
        console.error(docsYmlResult.error);
    }

    return (
        <EditorShell>
            <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
                <OrgNameProvider orgName={orgName}>
                    <BranchProvider branch={branch}>
                        <GitHubRepoProvider branch={branch} sourceRepo={sourceRepo} docsUrl={docsUrl}>
                            <BranchInitializer
                                orgName={orgName}
                                site={docsUrl}
                                owner={sourceRepo.owner}
                                repo={sourceRepo.repo}
                                branch={branch}
                                baseBranch={sourceRepo.baseBranch}
                            />
                            <ClientNavigationProvider
                                branchName={branch}
                                orgName={orgName}
                                docsUrl={docsUrl}
                                initialDocsYmlContent={initialDocsYmlContent}
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
