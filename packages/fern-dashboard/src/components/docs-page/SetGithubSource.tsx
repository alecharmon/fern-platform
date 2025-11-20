"use client";

import { useRouter } from "@bprogress/next/app";
import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import ExclamationCircleIcon from "@heroicons/react/24/outline/ExclamationCircleIcon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useState } from "react";
import type { ValidateGithubRepoAccess } from "@/app/api/validate-github-repo-access/route";
import type { ValidateGitlabRepoAccess } from "@/app/api/validate-gitlab-repo-access/route";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { parseGitUrl } from "@/app/services/git-common/url-parse.client";
import { normalizeGithubUrl } from "@/app/services/github/github";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";

import { ErrorEditSourceToast, ErrorInvalidGithubUrlToast, SuccessfulEditSourceToast } from "../editor/EditorToasts";
import { captureRepoConnected } from "../posthog/events";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function SetGithubSourcePopover({
    docsUrl,
    children,
    setIsSaving,
    initialUrl
}: {
    docsUrl: DocsUrl;
    children: React.ReactNode;
    setIsSaving: (isSaving: boolean) => void;
    initialUrl?: string;
}) {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [inputUrl, setInputUrl] = useState("");
    const [debouncedUrl, setDebouncedUrl] = useState("");

    const router = useRouter();
    const queryClient = useQueryClient();
    const posthog = usePostHog();

    useEffect(() => {
        if (isPopoverOpen && initialUrl) {
            setInputUrl(initialUrl);
        }
    }, [isPopoverOpen, initialUrl]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedUrl(inputUrl);
        }, 500);
        return () => clearTimeout(timer);
    }, [inputUrl]);

    const parsedUrl = parseGitUrl(debouncedUrl);
    const isGitHub = parsedUrl.provider === "github";
    const isGitLab = parsedUrl.provider === "gitlab";

    const normalized = isGitHub ? normalizeGithubUrl(debouncedUrl) : null;
    const shouldCheckGithubAccess = isGitHub && normalized?.isValidShape && normalized.owner && normalized.repo;
    const shouldCheckGitlabAccess = isGitLab && parsedUrl.owner && parsedUrl.repo;

    const { data: githubAccessResult, isLoading: isCheckingGithubAccess } =
        useQuery<ValidateGithubRepoAccess.Response | null>({
            queryKey: ["github-repo-access", docsUrl, normalized?.owner, normalized?.repo],
            queryFn: async () => {
                if (!normalized?.owner || !normalized.repo) {
                    return null;
                }
                return await DashboardApiClient.validateGitRepoAccess({
                    url: docsUrl,
                    owner: normalized.owner,
                    repo: normalized.repo
                });
            },
            enabled: shouldCheckGithubAccess ? true : false,
            staleTime: 0,
            retry: false
        });

    const { data: gitlabAccessResult, isLoading: isCheckingGitlabAccess } =
        useQuery<ValidateGitlabRepoAccess.Response | null>({
            queryKey: ["gitlab-repo-access", docsUrl, parsedUrl.owner, parsedUrl.repo],
            queryFn: async () => {
                if (!parsedUrl.owner || !parsedUrl.repo) {
                    return null;
                }
                return await DashboardApiClient.validateGitlabRepoAccess({
                    url: docsUrl,
                    owner: parsedUrl.owner,
                    repo: parsedUrl.repo
                });
            },
            enabled: shouldCheckGitlabAccess ? true : false,
            staleTime: 0,
            retry: false
        });

    const accessCheckResult = isGitHub ? githubAccessResult : isGitLab ? gitlabAccessResult : null;
    const isCheckingAccess = isGitHub ? isCheckingGithubAccess : isGitLab ? isCheckingGitlabAccess : false;

    const handleConnectRepo = useCallback(
        async (gitUrl: string) => {
            const parsedUrl = parseGitUrl(gitUrl);
            const isGitHub = parsedUrl.provider === "github";
            const isGitLab = parsedUrl.provider === "gitlab";

            let canonicalUrl: string | null = null;

            if (isGitHub) {
                const normalized = normalizeGithubUrl(gitUrl);
                if (!normalized.isValidShape || !normalized.canonicalUrl) {
                    ErrorInvalidGithubUrlToast();
                    return;
                }
                canonicalUrl = normalized.canonicalUrl;
            } else if (isGitLab) {
                if (!parsedUrl.owner || !parsedUrl.repo) {
                    ErrorInvalidGithubUrlToast();
                    return;
                }
                canonicalUrl = `https://gitlab.com/${parsedUrl.owner}/${parsedUrl.repo}`;
            } else {
                ErrorInvalidGithubUrlToast();
                return;
            }

            try {
                setIsSaving(true);
                setIsPopoverOpen(false);
                await DashboardApiClient.postDocsGithubSource({
                    url: docsUrl,
                    gitUrl: canonicalUrl
                });

                await queryClient.invalidateQueries({
                    queryKey: ReactQueryKey.githubSourceRepo(docsUrl)
                });
                router.refresh();

                SuccessfulEditSourceToast();

                captureRepoConnected(posthog, {
                    siteHasGitHubAppInstalled: accessCheckResult?.ok ?? false,
                    siteHasConnectedRepo: true
                });

                setInputUrl("");
            } catch (e) {
                ErrorEditSourceToast();
                console.error(e);
            } finally {
                setIsSaving(false);
            }
        },
        [docsUrl, queryClient, setIsSaving, router, posthog, accessCheckResult]
    );

    const currentParsedUrl = parseGitUrl(inputUrl);
    const currentIsGitHub = currentParsedUrl.provider === "github";
    const currentIsGitLab = currentParsedUrl.provider === "gitlab";

    const currentNormalized = currentIsGitHub ? normalizeGithubUrl(inputUrl) : null;
    const urlIsValid =
        (currentIsGitHub && currentNormalized?.isValidShape) ||
        (currentIsGitLab && currentParsedUrl.owner && currentParsedUrl.repo);
    const showValidation = inputUrl.trim() !== "";

    const hasAccessGranted = accessCheckResult?.ok === true;
    const hasAccessDenied = accessCheckResult?.ok === false;
    const appNotInstalled = hasAccessDenied && "appInstalled" in accessCheckResult && !accessCheckResult.appInstalled;

    const readyToSave =
        urlIsValid &&
        hasAccessGranted &&
        ((currentIsGitHub &&
            normalized?.owner === currentNormalized?.owner &&
            normalized?.repo === currentNormalized?.repo) ||
            (currentIsGitLab &&
                parsedUrl.owner === currentParsedUrl.owner &&
                parsedUrl.repo === currentParsedUrl.repo)) &&
        !isCheckingAccess;

    return (
        <Popover
            open={isPopoverOpen}
            onOpenChange={(open) => {
                setIsPopoverOpen(open);
                if (!open) {
                    setInputUrl("");
                }
            }}
        >
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="border-border w-80 rounded-xl border p-0" align="start">
                <div className="flex flex-col">
                    <div className="flex flex-col gap-2 p-3">
                        <div
                            className={`border-border flex flex-1 items-center rounded-md border pr-0.5 transition-colors ${
                                showValidation
                                    ? urlIsValid && hasAccessGranted
                                        ? "border-green-600 dark:border-green-600"
                                        : urlIsValid && hasAccessDenied
                                          ? "border-red-500 dark:border-red-600"
                                          : urlIsValid
                                            ? "border-green-600 dark:border-green-600"
                                            : "border-red-500 dark:border-red-600"
                                    : ""
                            }`}
                        >
                            <Input
                                placeholder="Paste GitHub or GitLab repo URL..."
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && readyToSave) {
                                        void handleConnectRepo(inputUrl);
                                    }
                                }}
                                className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
                            />
                            {showValidation && urlIsValid && isCheckingAccess && (
                                <Loader2 className="mr-1.5 size-4 animate-spin text-gray-500" />
                            )}
                            {showValidation && urlIsValid && !isCheckingAccess && hasAccessGranted && (
                                <CheckCircleIcon className="mr-1.5 size-4 text-green-600 dark:text-green-600" />
                            )}
                            {showValidation && urlIsValid && !isCheckingAccess && hasAccessDenied && (
                                <ExclamationCircleIcon className="mr-1.5 size-4 text-red-500 dark:text-red-600" />
                            )}
                            {showValidation && !urlIsValid && (
                                <ExclamationCircleIcon className="mr-1.5 size-4 text-red-500 dark:text-red-600" />
                            )}
                        </div>
                        {showValidation && urlIsValid && currentParsedUrl.owner && currentParsedUrl.repo && (
                            <div className="text-muted-foreground text-xs">
                                Detected: {currentParsedUrl.owner}/{currentParsedUrl.repo}
                            </div>
                        )}
                        {showValidation && !urlIsValid && (
                            <div className="text-xs text-red-500 dark:text-red-600">
                                Please enter a valid GitHub or GitLab repository URL
                            </div>
                        )}
                        {showValidation && urlIsValid && hasAccessDenied && accessCheckResult?.error && (
                            <div className="text-xs text-red-500 dark:text-red-600">
                                {accessCheckResult.error.message}
                            </div>
                        )}
                        {showValidation && urlIsValid && currentIsGitHub && appNotInstalled && (
                            <a
                                href="https://github.com/apps/fern-api/installations/new"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary text-xs hover:underline"
                            >
                                Install Fern GitHub App →
                            </a>
                        )}
                        <Button
                            onClick={() => void handleConnectRepo(inputUrl)}
                            disabled={!readyToSave}
                            className="w-full"
                        >
                            Save
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
