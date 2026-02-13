"use client";

import { CheckCircleIcon, ExternalLinkIcon, GitMergeIcon, GitPullRequestIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { createCustomDomainPr } from "@/app/actions/customDomain";
import { type GitProvider, getGitConnectionStatus } from "@/app/actions/customDomain/getGitConnectionStatus";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../../ui/button";

export interface GitStatus {
    checked: boolean;
    connected: boolean;
    provider?: GitProvider;
    gitUrl?: string;
    baseBranch?: string;
}

interface UpdateConfigContentProps {
    domainInfo: CustomDomainInfo;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    isSubpathDomain: boolean;
    subpath: string;
    onConfigUpdated: () => void;
    gitStatus: GitStatus;
    onGitStatusChange: (status: GitStatus) => void;
    prUrl: string | null;
    onPrCreated: (url: string) => void;
}

export function UpdateConfigContent({
    domainInfo,
    docsUrl,
    orgName,
    isSubpathDomain,
    subpath,
    onConfigUpdated,
    gitStatus,
    onGitStatusChange,
    prUrl,
    onPrCreated
}: UpdateConfigContentProps) {
    const [isCreatingPr, setIsCreatingPr] = useState(false);

    const prTerminology = gitStatus.provider === "gitlab" ? "Merge Request" : "Pull Request";
    const prShortTerminology = gitStatus.provider === "gitlab" ? "MR" : "PR";
    const PrIcon = gitStatus.provider === "gitlab" ? GitMergeIcon : GitPullRequestIcon;

    // If the dashboard is already being viewed at the custom domain URL,
    // the config has been published — the custom domain is the main URL.
    const isAlreadyPublished = docsUrl === domainInfo.domain;

    useEffect(() => {
        if (isAlreadyPublished) {
            onConfigUpdated();
        }
    }, [isAlreadyPublished, onConfigUpdated]);

    const checkGitStatus = useCallback(async () => {
        if (gitStatus.checked) {
            return;
        }

        const timeoutPromise = new Promise<{ connected: false }>((resolve) =>
            setTimeout(() => resolve({ connected: false }), 5000)
        );

        const gitPromise = getGitConnectionStatus({ docsUrl, orgName });
        const gitResult = await Promise.race([gitPromise, timeoutPromise]);

        onGitStatusChange({
            checked: true,
            connected: gitResult.connected,
            provider: "provider" in gitResult ? gitResult.provider : undefined,
            gitUrl: "gitUrl" in gitResult ? gitResult.gitUrl : undefined,
            baseBranch: "baseBranch" in gitResult ? gitResult.baseBranch : undefined
        });
    }, [docsUrl, orgName, gitStatus.checked, onGitStatusChange]);

    useEffect(() => {
        if (!isAlreadyPublished) {
            checkGitStatus();
        }
    }, [checkGitStatus, isAlreadyPublished]);

    const handleCreatePr = async () => {
        if (!gitStatus.connected || !gitStatus.gitUrl) {
            return;
        }

        setIsCreatingPr(true);
        try {
            const result = await createCustomDomainPr({
                orgName,
                docsUrl,
                gitUrl: gitStatus.gitUrl,
                customDomain: domainInfo.domain,
                baseBranch: gitStatus.baseBranch ?? "main"
            });

            if (result.success && result.prUrl) {
                onPrCreated(result.prUrl);
                toast.success(`${prTerminology} created successfully!`);
            } else {
                toast.error(result.error ?? `Failed to create ${prTerminology.toLowerCase()}`);
            }
        } catch (err) {
            console.error(`Failed to create ${prShortTerminology}:`, err);
            toast.error(`Failed to create ${prTerminology.toLowerCase()}`);
        } finally {
            setIsCreatingPr(false);
        }
    };

    // If already published, this component won't be visible (status is "complete")
    // but guard against flash of content
    if (isAlreadyPublished) {
        return null;
    }

    return (
        <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
                To use <strong>{domainInfo.domain}</strong> as your custom domain, update your{" "}
                <code className="rounded bg-muted px-1">docs.yml</code> configuration and publish.
            </p>

            {/* PR/MR already created - show link + option to create new one */}
            {prUrl && (
                <div className="space-y-4">
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20 text-primary">
                        <div className="flex items-start gap-3">
                            <CheckCircleIcon className="mt-0.5 size-5 text-primary" />
                            <div className="space-y-2">
                                <p className="font-medium">{prTerminology} Created</p>
                                <p className="text-sm">
                                    Merge the {prShortTerminology} and publish your docs. This step will complete
                                    automatically when you reload the dashboard.
                                </p>

                                <a
                                    href={prUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="fern-link inline-flex! items-center gap-1 text-sm font-medium"
                                >
                                    View {prTerminology}
                                    <ExternalLinkIcon className="size-3" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {gitStatus.checked && gitStatus.connected && (
                        <Button
                            variant="outline"
                            onClick={handleCreatePr}
                            disabled={isCreatingPr}
                            loading={isCreatingPr}
                            className="w-full"
                        >
                            <PrIcon className="mr-2 size-4" />
                            Create New {prTerminology}
                        </Button>
                    )}
                </div>
            )}

            {/* Loading state while checking repository connection */}
            {!prUrl && !gitStatus.checked && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    Checking repository connection...
                </div>
            )}

            {/* Repository connected - show PR/MR option */}
            {!prUrl && gitStatus.checked && gitStatus.connected && (
                <div className="space-y-4">
                    <div className="rounded-md border border-border bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                            <PrIcon className="mt-0.5 size-5 text-muted-foreground" />
                            <div className="space-y-1">
                                <p className="font-medium">Create a {prTerminology}</p>
                                <p className="text-muted-foreground text-sm">
                                    {isSubpathDomain ? (
                                        <>
                                            We&apos;ll create a {prShortTerminology} that updates the{" "}
                                            <code className="rounded bg-muted px-1">url</code> field and adds the{" "}
                                            <code className="rounded bg-muted px-1">custom-domain</code> field to your
                                            docs.yml file.
                                        </>
                                    ) : (
                                        <>
                                            We&apos;ll create a {prShortTerminology} that adds the{" "}
                                            <code className="rounded bg-muted px-1">custom-domain</code> field to your
                                            docs.yml file.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button onClick={handleCreatePr} disabled={isCreatingPr} loading={isCreatingPr} className="w-full">
                        <PrIcon className="mr-2 size-4" />
                        Create {prTerminology}
                    </Button>
                </div>
            )}

            {/* Repository not connected - show manual instructions */}
            {!prUrl && gitStatus.checked && !gitStatus.connected && (
                <div className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                        The instance field in your <code className="rounded bg-muted px-1">docs.yml</code> file should
                        reflect the following:
                    </p>
                    <div className="rounded-md border border-border bg-muted/50 p-3 font-mono text-sm">
                        <div className="text-muted-foreground">instances:</div>
                        {isSubpathDomain ? (
                            <div className="ml-4 space-y-0">
                                <div>
                                    <span className="text-muted-foreground">- url:</span>{" "}
                                    <span className="text-foreground">
                                        {docsUrl}
                                        <strong>{subpath}</strong>
                                    </span>
                                </div>
                                <div className="ml-4 font-semibold">
                                    <span className="text-muted-foreground">custom-domain:</span>{" "}
                                    <span className="text-foreground">{domainInfo.domain}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="ml-4 space-y-0">
                                <div>
                                    <span className="text-muted-foreground">- url:</span>{" "}
                                    <span className="text-foreground">{docsUrl}</span>
                                </div>
                                <div className="ml-4">
                                    <span className="text-muted-foreground">custom-domain:</span>{" "}
                                    <span className="text-foreground">{domainInfo.domain}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                        After updating your docs.yml, commit, push, and publish your docs. This step will complete
                        automatically when you reload the dashboard.
                    </p>
                </div>
            )}
        </div>
    );
}
