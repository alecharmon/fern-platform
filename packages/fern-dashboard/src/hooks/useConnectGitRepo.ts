import { useQueryClient } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { normalizeGithubUrl } from "@/app/services/github/github";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";
import {
    ErrorEditSourceToast,
    ErrorInvalidGitUrlToast,
    SuccessfulEditSourceToast
} from "../components/editor/EditorToasts";
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
 * Hook that provides a reusable function for connecting a GitHub repository to a docs site.
 * Handles validation, normalization, API calls, cache invalidation, and toast notifications.
 *
 * @param options Configuration options
 * @returns Object with connectRepo function and normalized GitHub URL (if provided)
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
            const parsedUrl = parseGitUrl(canonicalUrl);
            const isGitHub = parsedUrl.provider === "github";
            const isGitLab = parsedUrl.provider === "gitlab";

            console.log("parsedUrl", parsedUrl);

            let normalizedCanonicalUrl: string | null = null;

            if (isGitHub) {
                const normalized = normalizeGithubUrl(canonicalUrl);
                if (!normalized.isValidShape || !normalized.canonicalUrl) {
                    ErrorInvalidGitUrlToast();
                    return { success: false, gitUrl: undefined };
                }
                normalizedCanonicalUrl = normalized.canonicalUrl;
            } else if (isGitLab) {
                const repoOrPath = parsedUrl.path ?? parsedUrl.repo;
                if (!parsedUrl.owner || !repoOrPath) {
                    ErrorInvalidGitUrlToast();
                    return { success: false, gitUrl: undefined };
                }
                normalizedCanonicalUrl = `https://gitlab.com/${parsedUrl.owner}/${repoOrPath}`;
            } else {
                ErrorInvalidGitUrlToast();
                return { success: false, gitUrl: undefined };
            }

            // If skipSave is true, just return the normalized URL without saving
            if (skipSave) {
                return { success: true, gitUrl: normalizedCanonicalUrl };
            }

            try {
                onStart?.();

                await DashboardApiClient.postDocsGithubSource({
                    url: docsUrl,
                    githubUrl: normalizedCanonicalUrl
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
                return { success: true, gitUrl: normalizedCanonicalUrl };
            } catch (e) {
                ErrorEditSourceToast();
                console.error(e);
                onError?.(e);
                return { success: false, gitUrl: normalizedCanonicalUrl };
            } finally {
                onFinally?.();
            }
        },
        [docsUrl, queryClient, posthog, onSuccess, onError, onStart, onFinally, showSuccessToast]
    );

    return { connectRepo };
}
