import { useQueryClient } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { normalizeGithubUrl } from "@/app/services/github/github";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";
import {
    ErrorEditSourceToast,
    ErrorInvalidGithubUrlToast,
    SuccessfulEditSourceToast
} from "../components/editor/EditorToasts";
import { captureRepoConnected } from "../components/posthog/events";

export interface UseConnectGithubRepoOptions {
    docsUrl: DocsUrl;
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
    onStart?: () => void;
    onFinally?: () => void;
    showSuccessToast?: boolean;
}

export interface ConnectGithubRepoParams {
    canonicalUrl: string;
    skipSave?: boolean;
}

/**
 * Hook that provides a reusable function for connecting a GitHub repository to a docs site.
 * Handles validation, normalization, API calls, cache invalidation, and toast notifications.
 *
 * @param options Configuration options
 * @returns Object with connectRepo function and normalized GitHub URL (if provided)
 */
export function useConnectGithubRepo({
    docsUrl,
    onSuccess,
    onError,
    onStart,
    onFinally,
    showSuccessToast = true
}: UseConnectGithubRepoOptions) {
    const queryClient = useQueryClient();
    const posthog = usePostHog();

    const connectRepo = useCallback(
        async ({ canonicalUrl, skipSave = false }: ConnectGithubRepoParams) => {
            const normalized = normalizeGithubUrl(canonicalUrl);
            if (!normalized.isValidShape || !normalized.canonicalUrl) {
                ErrorInvalidGithubUrlToast();
                return { success: false, githubUrl: undefined };
            }

            // If skipSave is true, just return the normalized URL without saving
            if (skipSave) {
                return { success: true, githubUrl: normalized.canonicalUrl };
            }

            try {
                onStart?.();

                await DashboardApiClient.postDocsGithubSource({
                    url: docsUrl,
                    githubUrl: normalized.canonicalUrl
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
                return { success: true, githubUrl: normalized.canonicalUrl };
            } catch (e) {
                ErrorEditSourceToast();
                console.error(e);
                onError?.(e);
                return { success: false, githubUrl: normalized.canonicalUrl };
            } finally {
                onFinally?.();
            }
        },
        [docsUrl, queryClient, posthog, onSuccess, onError, onStart, onFinally, showSuccessToast]
    );

    return { connectRepo };
}
