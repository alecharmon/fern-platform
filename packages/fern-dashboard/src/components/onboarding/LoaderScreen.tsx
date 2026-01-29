"use client";

import { AppWindow } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkflowStatus } from "@/app/api/onboarding-docs/workflow-status/route";
import { PublishingStepCard, type PublishingStepState } from "@/components/onboarding/PublishingStepCard";
import { AddCollaboratorModal } from "@/components/shared/AddCollaboratorModal";
import type { WizardFormData } from "@/providers/OnboardingProvider";
import {
    getDocsCommitSha,
    getGithubRepoData,
    getSitePublishUrl,
    saveDocsCommitSha,
    saveGithubRepoData
} from "@/utils/onboardingSession";
import { cn } from "@/utils/utils";
import { GithubLogo } from "../auth/GithubLogo";
import { clearRepoSetupResult, getRepoSetupResult, waitForRepoSetup } from "./repoSetupStorage";

const POLL_INTERVAL_MS = 2000;

interface LoaderScreenProps {
    wizardFormData: WizardFormData;
    orgName?: string;
    showLogs?: boolean;
    sessionId?: string;
    onComplete?: (result: { url: string; fernDocsDownloadUrl?: string; githubRepoUrl?: string }) => void;
}

const PUBLISHING_STEPS = [
    {
        id: "github",
        title: "GitHub Repo",
        completeActionLabel: "Add as collaborator",
        inProgressActionLabel: "Creating repository",
        icon: <GithubLogo width={20} height={20} />
    },
    {
        id: "docs",
        title: "Docs site",
        completeActionLabel: "View site",
        inProgressActionLabel: "Publishing site", // Will be overridden dynamically
        icon: <AppWindow className="h-5 w-5" />
    }
] as const;

type PublishingStepId = (typeof PUBLISHING_STEPS)[number]["id"];
type PublishingStepStateMap = Record<PublishingStepId, PublishingStepState>;

// Publishing workflow status
type PublishingPhase = "repo" | "customizing" | "polling" | "complete";

/**
 * Gets or creates the repo for publishing.
 *
 * Three scenarios:
 * 1. Repo was pre-created at org creation → success in localStorage → use it
 * 2. Repo setup is pending → wait for it (up to 45s)
 * 3. No repo setup happened (existing org, or failed) → create on-demand
 */
async function getOrCreateRepoForPublishing(orgName: string): Promise<{
    owner: string;
    repoName: string;
    githubRepoUrl: string;
}> {
    // Check localStorage for pre-created repo
    const storedResult = getRepoSetupResult(orgName);

    // Case 1: Repo already created
    if (storedResult?.status === "success" && storedResult.repoName && storedResult.githubRepoUrl) {
        console.log("[getOrCreateRepo] Using pre-created repo:", storedResult.repoName);
        const urlParts = storedResult.githubRepoUrl.split("/");
        const owner = urlParts[urlParts.length - 2] || "";
        return { owner, repoName: storedResult.repoName, githubRepoUrl: storedResult.githubRepoUrl };
    }

    // Case 2: Repo setup in progress - wait for it
    if (storedResult?.status === "pending") {
        console.log("[getOrCreateRepo] Repo setup in progress, waiting...");
        const result = await waitForRepoSetup(orgName, 45000);
        if (result) {
            console.log("[getOrCreateRepo] Repo setup completed:", result.repoName);
            const urlParts = result.githubRepoUrl.split("/");
            const owner = urlParts[urlParts.length - 2] || "";
            return { owner, ...result };
        }
        console.log("[getOrCreateRepo] Timed out waiting for repo, will create now");
        // If wait times out, fall through to create on-demand
    }

    // Case 3: No repo setup happened (existing org) or failed - create on-demand
    console.log("[getOrCreateRepo] Creating repo on-demand...");
    const response = await fetch("/api/onboarding-docs/set-up-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create repository");
    }

    const data = await response.json();
    const urlParts = data.githubRepoUrl.split("/");
    const owner = urlParts[urlParts.length - 2] || "";
    console.log("[getOrCreateRepo] Repo created:", data.repoName);
    return { owner, repoName: data.repoName, githubRepoUrl: data.githubRepoUrl };
}

/**
 * Reads a File object as base64 string
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(",")[1];
            resolve(base64 || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Fetches a blob URL and returns base64 data
 */
async function blobUrlToBase64(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64 || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Performs customization: reads files as base64 and calls the customize API.
 * Logo/favicon are sent as base64 data directly to avoid S3 upload.
 * API specs are pre-uploaded to S3 in the API spec step, URLs are in formData.openApiSpecUrls.
 */
async function performCustomization(
    formData: WizardFormData,
    repoData: { repoName: string; githubRepoUrl: string },
    orgName: string
): Promise<{ commitSha?: string; docsUrl?: string }> {
    // API spec URLs are already uploaded in the API spec step
    const uploadedSpecUrls = formData.openApiSpecUrls ?? [];

    // Convert logo/favicon to base64 (no S3 upload needed)
    let logoData: string | null = null;
    let logoFileName: string | null = null;
    let faviconData: string | null = null;
    let faviconFileName: string | null = null;

    // Favicon: convert to base64
    if (formData.faviconFile) {
        faviconData = await fileToBase64(formData.faviconFile);
        faviconFileName = formData.faviconFileName || formData.faviconFile.name;
    } else if (formData.faviconUrl) {
        if (formData.faviconUrl.startsWith("blob:")) {
            // Blob URL from BrandFetch - fetch and convert
            faviconData = await blobUrlToBase64(formData.faviconUrl);
            faviconFileName = formData.faviconFileName || "favicon.png";
        }
        // Note: external URLs (non-blob) can be passed directly to the API
        // which will download them. But we prefer base64 when we have the data.
    }

    // Logo: convert to base64
    if (formData.logoFile) {
        logoData = await fileToBase64(formData.logoFile);
        logoFileName = formData.logoFileName || formData.logoFile.name;
    } else if (formData.logoUrl) {
        if (formData.logoUrl.startsWith("blob:")) {
            // Blob URL from BrandFetch - fetch and convert
            logoData = await blobUrlToBase64(formData.logoUrl);
            logoFileName = formData.logoFileName || "logo.png";
        }
        // Note: external URLs (non-blob) can be passed directly to the API
    }

    // Call customize API with base64 data for logo/favicon
    const customizeRequestBody: Record<string, unknown> = {
        orgName,
        docsSiteName: formData.docsSiteName,
        docsSiteUrl: formData.docsSiteUrl,
        primaryColorHex: formData.primaryColorHex,
        openApiSpecUrls: uploadedSpecUrls
    };

    // Add logo (prefer base64, fall back to URL)
    if (logoData) {
        customizeRequestBody.logoData = logoData;
        customizeRequestBody.logoFileName = logoFileName;
    } else if (formData.logoUrl && !formData.logoUrl.startsWith("blob:")) {
        customizeRequestBody.logoUrl = formData.logoUrl;
        customizeRequestBody.logoFileName = formData.logoFileName;
    }

    // Add favicon (prefer base64, fall back to URL)
    if (faviconData) {
        customizeRequestBody.faviconData = faviconData;
        customizeRequestBody.faviconFileName = faviconFileName;
    } else if (formData.faviconUrl && !formData.faviconUrl.startsWith("blob:")) {
        customizeRequestBody.faviconUrl = formData.faviconUrl;
        customizeRequestBody.faviconFileName = formData.faviconFileName;
    }

    const response = await fetch(`/api/onboarding-docs/customize/${repoData.repoName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customizeRequestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to customize documentation");
    }

    return await response.json();
}

export function LoaderScreen({ wizardFormData, orgName, showLogs = false, sessionId, onComplete }: LoaderScreenProps) {
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stepStates, setStepStates] = useState<PublishingStepStateMap>(() => ({
        github: "in-progress",
        docs: "not-started"
    }));
    const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(() => getGithubRepoData()?.repoUrl ?? null);
    const [docsUrl, setDocsUrl] = useState<string | null>(() => getSitePublishUrl());
    const [publishingPhase, setPublishingPhase] = useState<PublishingPhase>("repo");
    const [docsStepLabel, setDocsStepLabel] = useState<string>("Applying branding");
    const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);

    const onCompleteRef = useRef(onComplete);
    const hasStartedPublishing = useRef(false);
    const hasLinkedRepo = useRef(false);

    // Extract repo name from URL (e.g., https://github.com/fern-support/my-repo -> my-repo)
    const repoName = githubRepoUrl?.split("/").pop() ?? "";

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    // Main publishing workflow - runs once on mount
    useEffect(() => {
        if (!showLogs || hasStartedPublishing.current || !orgName) {
            return;
        }
        hasStartedPublishing.current = true;

        const runPublishing = async () => {
            try {
                // Step 1: Get or create the repository
                console.log("[LoaderScreen] Step 1: Getting repository...");
                setStepStates({ github: "in-progress", docs: "not-started" });
                setPublishingPhase("repo");

                const repoResult = await getOrCreateRepoForPublishing(orgName);
                saveGithubRepoData(repoResult.owner, repoResult.repoName, repoResult.githubRepoUrl);
                setGithubRepoUrl(repoResult.githubRepoUrl);

                // GitHub repo is ready - user can now "Take ownership"
                console.log("[LoaderScreen] Repo ready:", repoResult.repoName);
                setStepStates({ github: "complete", docs: "in-progress" });
                setDocsStepLabel("Applying branding");
                setPublishingPhase("customizing");

                // Step 2: Upload assets and customize the repository
                console.log("[LoaderScreen] Step 2: Customizing repository...");
                const customizeResult = await performCustomization(wizardFormData, repoResult, orgName);

                if (customizeResult.commitSha) {
                    saveDocsCommitSha(customizeResult.commitSha);
                }
                if (customizeResult.docsUrl) {
                    setDocsUrl(customizeResult.docsUrl);
                }

                // Clean up stored repo setup result
                clearRepoSetupResult(orgName);

                // Step 3: Start polling for workflow completion
                console.log("[LoaderScreen] Step 3: Polling workflow status...");
                setDocsStepLabel("Publishing site");
                setPublishingPhase("polling");
            } catch (err) {
                console.error("[LoaderScreen] Publishing error:", err);
                setError(err instanceof Error ? err.message : "An error occurred");
            }
        };

        runPublishing();
    }, [showLogs, orgName, wizardFormData]);

    // Poll workflow status to update step states
    const pollWorkflowStatus = useCallback(async () => {
        const repoData = getGithubRepoData();
        if (!repoData) {
            console.log("[LoaderScreen] No repo data, skipping poll");
            return;
        }

        // Get the docs commit SHA to track the first workflow (docs without API specs)
        const commitSha = getDocsCommitSha();
        console.log("[LoaderScreen] Polling workflow status", { repoData, commitSha });

        try {
            const response = await fetch("/api/onboarding-docs/workflow-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner: repoData.owner,
                    repoName: repoData.repoName,
                    commitSha: commitSha ?? undefined // Only include if we have it
                })
            });

            if (!response.ok) {
                console.log("[LoaderScreen] Poll response not ok:", response.status);
                return;
            }

            const status: WorkflowStatus = await response.json();
            console.log("[LoaderScreen] Workflow status:", status);

            if (status.status === "completed") {
                console.log("[LoaderScreen] Workflow completed with conclusion:", status.conclusion);
                if (status.conclusion === "success") {
                    console.log("[LoaderScreen] Setting isComplete=true");
                    setIsComplete(true);
                    setStepStates((prev) => {
                        if (prev.github === "complete" && prev.docs === "complete") {
                            return prev;
                        }
                        return { github: "complete", docs: "complete" };
                    });
                    const publishUrl = getSitePublishUrl();
                    if (publishUrl) {
                        setDocsUrl((prev) => (prev === publishUrl ? prev : publishUrl));
                    }

                    // Link the GitHub repo to the docs site now that it exists in FDR
                    // This needs to happen after the workflow completes because the docs URL
                    // isn't registered in FDR until `fern generate --docs` runs
                    if (publishUrl && repoData.repoUrl && !hasLinkedRepo.current) {
                        hasLinkedRepo.current = true;
                        try {
                            const linkResponse = await fetch("/api/onboarding-docs/link-repo", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    docsUrl: publishUrl.replace("https://", ""),
                                    githubUrl: repoData.repoUrl
                                    // orgName intentionally omitted - looked up securely from FDR
                                })
                            });
                            if (linkResponse.ok) {
                                console.log("[LoaderScreen] Successfully linked repo to docs site");
                            } else {
                                console.error("[LoaderScreen] Failed to link repo:", await linkResponse.text());
                            }
                        } catch (linkError) {
                            console.error("[LoaderScreen] Error linking repo:", linkError);
                        }
                    }

                    if (onCompleteRef.current) {
                        onCompleteRef.current({
                            url: publishUrl || "",
                            githubRepoUrl: repoData.repoUrl
                        });
                    }
                } else {
                    setError("Build failed. Check GitHub Actions for details.");
                    setStepStates((prev) => {
                        if (prev.github === "complete" && prev.docs === "complete") {
                            return prev;
                        }
                        return { github: "complete", docs: "complete" };
                    });
                }
            } else if (status.status === "in_progress") {
                setStepStates((prev) => {
                    if (prev.github === "complete" && prev.docs === "in-progress") {
                        return prev;
                    }
                    return { github: "complete", docs: "in-progress" };
                });
            } else if (status.status === "queued" || status.status === "not_found") {
                // Still waiting for workflow to start - keep current state if already showing in-progress
                setStepStates((prev) => {
                    if (prev.github === "complete" && prev.docs === "in-progress") {
                        return prev;
                    }
                    return { github: "complete", docs: "in-progress" };
                });
            }
        } catch (err) {
            console.error("[LoaderScreen] Error polling workflow status:", err);
        }
    }, []);

    // Only start polling when we're in the polling phase
    useEffect(() => {
        if (!showLogs || isComplete || publishingPhase !== "polling") {
            return;
        }

        console.log("[LoaderScreen] Starting polling, publishingPhase:", publishingPhase);

        // Poll immediately
        pollWorkflowStatus();

        // Then poll periodically
        const intervalId = setInterval(() => {
            console.log("[LoaderScreen] Polling...");
            pollWorkflowStatus();
        }, POLL_INTERVAL_MS);

        return () => {
            console.log("[LoaderScreen] Cleaning up polling interval");
            clearInterval(intervalId);
        };
    }, [showLogs, isComplete, publishingPhase, pollWorkflowStatus]);

    return (
        <div className="flex w-full flex-col gap-8">
            <h1 className="text-xl font-semibold text-left">Your site is publishing!</h1>

            {showLogs && (
                <div className="w-full max-w-3xl space-y-5">
                    {PUBLISHING_STEPS.map((step, index) => {
                        const state = stepStates[step.id];
                        const previousState = index > 0 ? stepStates[PUBLISHING_STEPS[index - 1]!.id] : null;
                        const nextState =
                            index < PUBLISHING_STEPS.length - 1 ? stepStates[PUBLISHING_STEPS[index + 1]!.id] : null;

                        const currentLineColor =
                            state === "complete"
                                ? "bg-green-500"
                                : state === "in-progress"
                                  ? "bg-primary"
                                  : "bg-gray-200 dark:bg-gray-800";

                        const topLineColor =
                            previousState === "complete" ? "bg-green-500" : "bg-gray-200 dark:bg-gray-800";

                        const bottomLineColor =
                            nextState === "complete" ? "bg-green-500" : "bg-gray-200 dark:bg-gray-800";

                        const actionUrl = step.id === "docs" ? docsUrl : undefined;
                        const isActionDisabled = step.id === "docs" && state !== "complete";
                        const onActionClick = step.id === "github" ? () => setIsCollaboratorModalOpen(true) : undefined;

                        return (
                            <div key={step.id} className="flex items-stretch gap-4">
                                <div className="flex w-4 flex-col items-center self-stretch">
                                    {index > 0 && <div className={cn("w-1 flex-1 rounded-full", topLineColor)} />}
                                    <div
                                        className={cn("w-1 rounded-full", currentLineColor)}
                                        style={{ minHeight: "100%" }}
                                    />
                                    {index < PUBLISHING_STEPS.length - 1 && (
                                        <div className={cn("w-1 flex-1 rounded-full", bottomLineColor)} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <PublishingStepCard
                                        title={step.title}
                                        state={state}
                                        icon={step.icon}
                                        completeActionLabel={step.completeActionLabel}
                                        inProgressActionLabel={
                                            step.id === "docs" ? docsStepLabel : step.inProgressActionLabel
                                        }
                                        completeActionUrl={actionUrl ?? undefined}
                                        isActionDisabled={isActionDisabled}
                                        onActionClick={onActionClick}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {orgName && repoName && (
                <AddCollaboratorModal
                    open={isCollaboratorModalOpen}
                    onOpenChange={setIsCollaboratorModalOpen}
                    orgName={orgName}
                    repoName={repoName}
                />
            )}

            {error && (
                <div className="border-border w-full max-w-3xl rounded-lg border bg-white p-4 text-sm text-red-800 dark:border-red-800 dark:bg-black dark:text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
}
