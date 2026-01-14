import "server-only";

import type { ApiSourceType } from "@fern-api/docs-loader";
import type React from "react";

import { getGithubSourceMetadata } from "@/app/actions/getGithubSourceMetadata";
import { getGitlabSourceMetadata } from "@/app/actions/getGitlabSourceMetadata";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import {
    ClientNavigationProvider,
    PreviewClientNavigationProvider
} from "@/components/editor/ClientNavigationProvider";
import { BranchInitializer } from "@/components/editor/git/BranchInitializer";
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
    // Check if Git is connected first to avoid unnecessary async calls
    const { gitUrl, session } = await assertAuthAndFetchGithubUrl(orgName, docsUrl);

    if (gitUrl == null) {
        return renderPreviewMode();
    }

    // Try to set up Git integration, but fall back to preview mode on any error
    try {
        // Determine provider and fetch appropriate metadata
        const parsed = parseGitUrl(gitUrl);
        const isGitLab = parsed.provider === "gitlab";

        const sourceRepo = isGitLab
            ? await getGitlabSourceMetadata({
                  gitlabUrl: gitUrl,
                  userId: session.user.sub
              })
            : await getGithubSourceMetadata({
                  githubUrl: gitUrl,
                  userId: session.user.sub
              });

        if (sourceRepo.owner == null || sourceRepo.repo == null || sourceRepo.baseBranch == null) {
            console.warn("[EditorProvidersWrapper] Source repo metadata incomplete, falling back to preview mode");
            return renderPreviewMode();
        }

        // TODO: lazy load this so we don't block the initial server render?
        // Use the factory function to get the appropriate loader (GitHub or GitLab)
        const gitLoader = await getGitLoader(gitUrl);

        // Fetch docs.yml references and API specs in parallel
        const [docsYmlAndReferences, apiSpecsResult] = await Promise.all([
            gitLoader.getDocsYmlAndReferences(
                sourceRepo.owner,
                sourceRepo.repo,
                docsUrl,
                branch, // fallback branch if default branch logic fails
                true // preferDefaultBranch = true
            ),
            gitLoader.getApiSpecs?.(sourceRepo.owner, sourceRepo.repo, docsUrl, branch, true)
        ]);

        // NOTE: Convert Map to array for RSC serialization (Map cannot be serialized by React Server Components)
        const latestDocsYmlAndReferences =
            docsYmlAndReferences.type === "ok" ? Array.from(docsYmlAndReferences.result.entries()) : null;
        const fernFolderPath =
            docsYmlAndReferences.type === "ok" ? docsYmlAndReferences.metadata.fernFolderPath : undefined;

        // Extract API specs (optional - don't fail if not available)
        // NOTE: We must convert Map/Set to Arrays before passing to client components,
        // as React Server Components cannot serialize Map/Set objects properly.
        const openApiSpecs = apiSpecsResult?.type === "ok" ? Array.from(apiSpecsResult.result.specs.entries()) : null;
        const apiSourceType: ApiSourceType | null =
            apiSpecsResult?.type === "ok" ? apiSpecsResult.result.sourceType : null;
        const openApiOverrideFilePaths =
            apiSpecsResult?.type === "ok" ? Array.from(apiSpecsResult.result.overrideFilePaths) : undefined;
        const generatorsYmlPath = apiSpecsResult?.type === "ok" ? apiSpecsResult.result.generatorsYmlPath : undefined;
        const generatorsYmlContent =
            apiSpecsResult?.type === "ok" ? apiSpecsResult.result.generatorsYmlContent : undefined;

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
                        openApiSpecs={openApiSpecs}
                        apiSourceType={apiSourceType}
                        openApiOverrideFilePaths={openApiOverrideFilePaths}
                        generatorsYmlPath={generatorsYmlPath}
                        generatorsYmlContent={generatorsYmlContent}
                    >
                        <GitPRProvider
                            owner={sourceRepo.owner}
                            repo={sourceRepo.repo}
                            baseBranch={sourceRepo.baseBranch}
                            branch={branch}
                            site={docsUrl}
                            gitUrl={gitUrl}
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
