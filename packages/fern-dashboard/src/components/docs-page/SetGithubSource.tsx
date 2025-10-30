import { useRouter } from "@bprogress/next/app";
import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import ExclamationCircleIcon from "@heroicons/react/24/outline/ExclamationCircleIcon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ValidateGithubRepoAccess } from "@/app/api/validate-github-repo-access/route";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { normalizeGithubUrl } from "@/app/services/github/github";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";

import { ErrorEditSourceToast, ErrorInvalidGithubUrlToast, SuccessfulEditSourceToast } from "../editor/EditorToasts";
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

    const normalized = normalizeGithubUrl(debouncedUrl);
    const shouldCheckAccess = normalized.isValidShape && normalized.owner && normalized.repo;

    const { data: accessCheckResult, isLoading: isCheckingAccess } = useQuery<ValidateGithubRepoAccess.Response | null>(
        {
            queryKey: ["github-repo-access", docsUrl, normalized.owner, normalized.repo],
            queryFn: async () => {
                if (!normalized.owner || !normalized.repo) {
                    return null;
                }
                return await DashboardApiClient.validateGithubRepoAccess({
                    url: docsUrl,
                    owner: normalized.owner,
                    repo: normalized.repo
                });
            },
            enabled: shouldCheckAccess ? true : false,
            staleTime: 0,
            retry: false
        }
    );

    const handleConnectRepo = useCallback(
        async (repoUrl: string) => {
            const normalized = normalizeGithubUrl(repoUrl);
            if (!normalized.isValidShape || !normalized.canonicalUrl) {
                ErrorInvalidGithubUrlToast();
                return;
            }

            try {
                setIsSaving(true);
                setIsPopoverOpen(false);
                await DashboardApiClient.postDocsGithubSource({
                    url: docsUrl,
                    githubUrl: normalized.canonicalUrl
                });

                await queryClient.invalidateQueries({
                    queryKey: ReactQueryKey.githubSourceRepo(docsUrl)
                });
                router.refresh();

                SuccessfulEditSourceToast();

                setInputUrl("");
            } catch (e) {
                ErrorEditSourceToast();
                console.error(e);
            } finally {
                setIsSaving(false);
            }
        },
        [docsUrl, queryClient, setIsSaving, router]
    );

    const currentNormalized = normalizeGithubUrl(inputUrl);
    const urlIsValid = currentNormalized.isValidShape;
    const showValidation = inputUrl.trim() !== "";

    const hasAccessGranted = accessCheckResult?.ok === true;
    const hasAccessDenied = accessCheckResult?.ok === false;
    const appNotInstalled = hasAccessDenied && !accessCheckResult?.appInstalled;

    const readyToSave =
        urlIsValid &&
        hasAccessGranted &&
        normalized.owner === currentNormalized.owner &&
        normalized.repo === currentNormalized.repo &&
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
                                placeholder="Paste GitHub repo URL..."
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
                        {showValidation && urlIsValid && currentNormalized.owner && currentNormalized.repo && (
                            <div className="text-muted-foreground text-xs">
                                Detected: {currentNormalized.owner}/{currentNormalized.repo}
                            </div>
                        )}
                        {showValidation && !urlIsValid && (
                            <div className="text-xs text-red-500 dark:text-red-600">
                                Please enter a valid GitHub repository URL
                            </div>
                        )}
                        {showValidation && urlIsValid && hasAccessDenied && accessCheckResult?.error && (
                            <div className="text-xs text-red-500 dark:text-red-600">
                                {accessCheckResult.error.message}
                            </div>
                        )}
                        {showValidation && urlIsValid && appNotInstalled && (
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
