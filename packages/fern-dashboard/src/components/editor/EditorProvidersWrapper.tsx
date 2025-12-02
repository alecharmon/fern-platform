import "server-only";

import type React from "react";
import { getGithubSourceMetadata } from "@/app/actions/getGithubSourceMetadata";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { getCachedGitHubLoader } from "@/app/services/github/cachedGitHubLoader";
import { BranchInitializer } from "@/components/editor/BranchInitializer";
import {
    ClientNavigationProvider,
    PreviewClientNavigationProvider
} from "@/components/editor/ClientNavigationProvider";
import { EditorPreviewProvider } from "@/providers/EditorPreviewProvider";
import { GitHubRepoProvider, PreviewGitHubRepoProvider } from "@/providers/GitHubRepoContext";
import { GitPRProvider, PreviewGitPRProvider } from "@/providers/GitPRContext";
import type { DocsUrl } from "@/utils/types";

interface EditorProvidersWrapperProps {
    children: React.ReactNode;
    branch: string;
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
}

/**
 * Wrapper component that conditionally renders GitHub-integrated providers for editable mode
 * or preview-only providers for preview mode.
 *
 * If GitHub is not connected or any GitHub validation fails, the editor automatically falls back to preview mode.
 */
export async function EditorProvidersWrapper({ children, branch, orgName, docsUrl }: EditorProvidersWrapperProps) {
    // Check if GitHub is connected first to avoid unnecessary async calls
    const { githubUrl, session } = await assertAuthAndFetchGithubUrl(orgName, docsUrl);

    if (githubUrl == null) {
        return renderPreviewMode();
    }

    // Try to set up GitHub integration, but fall back to preview mode on any error
    try {
        const sourceRepo = await getGithubSourceMetadata({
            githubUrl,
            userId: session.user.sub
        });

        if (sourceRepo.owner == null || sourceRepo.repo == null || sourceRepo.baseBranch == null) {
            console.warn("[EditorProvidersWrapper] Source repo metadata incomplete, falling back to preview mode");
            return renderPreviewMode();
        }

        // TODO: lazy load this so we don't block the initial server render?
        const githubLoader = await getCachedGitHubLoader(githubUrl);

        // Use the repo's default branch by passing preferDefaultBranch=true
        const docsYmlAndReferences = await githubLoader.getDocsYmlAndReferences(
            sourceRepo.owner,
            sourceRepo.repo,
            docsUrl,
            branch, // fallback branch if default branch logic fails
            true // preferDefaultBranch = true
        );
        const latestDocsYmlAndReferences = docsYmlAndReferences.type === "ok" ? docsYmlAndReferences.result : null;
        const fernFolderPath =
            docsYmlAndReferences.type === "ok" ? docsYmlAndReferences.metadata.fernFolderPath : undefined;

        if (docsYmlAndReferences.type !== "ok") {
            console.error("[EditorProvidersWrapper] Failed to load docs.yml", docsYmlAndReferences.error);
            return renderPreviewMode();
        }
        if (latestDocsYmlAndReferences == null) {
            console.warn("[EditorProvidersWrapper] Could not load docs configuration, falling back to preview mode");
            return renderPreviewMode();
        }

        // GitHub integration successful - render in editable mode
        return (
            <EditorPreviewProvider isPreview={false}>
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
                        latestDocsYmlAndReferences={latestDocsYmlAndReferences}
                        fernFolderPath={fernFolderPath}
                    >
                        <GitPRProvider
                            owner={sourceRepo.owner}
                            repo={sourceRepo.repo}
                            baseBranch={sourceRepo.baseBranch}
                            branch={branch}
                            site={docsUrl}
                        >
                            {children}
                        </GitPRProvider>
                    </ClientNavigationProvider>
                </GitHubRepoProvider>
            </EditorPreviewProvider>
        );
    } catch (error) {
        // Any GitHub validation failure triggers preview mode
        console.warn("[EditorProvidersWrapper] GitHub validation failed, entering preview mode:", error);
        return renderPreviewMode();
    }

    // Helper function to render preview mode providers
    function renderPreviewMode() {
        return (
            <EditorPreviewProvider isPreview>
                <PreviewGitHubRepoProvider branch={branch} docsUrl={docsUrl}>
                    <PreviewClientNavigationProvider branchName={branch} orgName={orgName} docsUrl={docsUrl}>
                        <PreviewGitPRProvider site={docsUrl}>{children}</PreviewGitPRProvider>
                    </PreviewClientNavigationProvider>
                </PreviewGitHubRepoProvider>
            </EditorPreviewProvider>
        );
    }
}
