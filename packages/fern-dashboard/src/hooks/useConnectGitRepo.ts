import { useQueryClient } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";

import type { PostDocsGithubSourceResponse } from "@/app/api/post-docs-github-source/handler";
import { ApiError, DashboardApiClient } from "@/app/services/dashboard-api/client";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";

import { ErrorConnectRepoToast, SuccessfulEditSourceToast } from "../components/editor/EditorToasts";
import { captureRepoConnected } from "../components/posthog/events";

export interface UseConnectGitRepoOptions {
    docsUrl: DocsUrl;
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
    onStart?: () => void;
    onFinally?: () => void;
    showSuccessToast?: boolean;
}

export interface ConnectGitRepoParams {
    canonicalUrl: string;
    skipSave?: boolean;
}

/**
 * Hook that provides a reusable function for connecting a git repository to a docs site.
 * Client-side only validates URL format; server-side validates git provider (GitHub, GitLab, GHE).
 *
 * @param options Configuration options
 * @returns Object with connectRepo function
 */
export function useConnectGitRepo({
    docsUrl,
    onSuccess,
    onError,
    onStart,
    onFinally,
    showSuccessToast = true
}: UseConnectGitRepoOptions) {
    const queryClient = useQueryClient();
    const posthog = usePostHog();

    const connectRepo = useCallback(
        async ({ canonicalUrl, skipSave = false }: ConnectGitRepoParams) => {
            const trimmedUrl = canonicalUrl.trim();

            // If skipSave is true, just return the URL without saving
            if (skipSave) {
                return { success: true, gitUrl: trimmedUrl };
            }

            try {
                onStart?.();

                // Server-side will validate if it's a valid git provider (GitHub, GitLab, GHE)
                await DashboardApiClient.postDocsGithubSource({
                    url: docsUrl,
                    githubUrl: trimmedUrl
                });

                await queryClient.invalidateQueries({
                    queryKey: ReactQueryKey.docsGithubUrl(docsUrl)
                });

                if (showSuccessToast) {
                    SuccessfulEditSourceToast();
                }

                captureRepoConnected(posthog, {
                    siteHasGitHubAppInstalled: true,
                    siteHasConnectedRepo: true
                });

                onSuccess?.();
                return { success: true, gitUrl: trimmedUrl };
            } catch (e) {
                // Parse the error response to show a specific error message
                let errorData: PostDocsGithubSourceResponse | undefined;
                if (e instanceof ApiError) {
                    try {
                        errorData = JSON.parse(e.body) as PostDocsGithubSourceResponse;
                    } catch {
                        // Failed to parse error body
                    }
                }

                if (errorData && !errorData.ok) {
                    ErrorConnectRepoToast(errorData.error);
                } else {
                    ErrorConnectRepoToast();
                }

                console.error(e);
                onError?.(e);
                return { success: false, gitUrl: trimmedUrl };
            } finally {
                onFinally?.();
            }
        },
        [docsUrl, queryClient, posthog, onSuccess, onError, onStart, onFinally, showSuccessToast]
    );

    return { connectRepo };
}
