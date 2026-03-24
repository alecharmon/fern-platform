"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkflowStatus } from "@/app/api/onboarding-docs/workflow-status/route";
import type { WizardFormData } from "@/providers/OnboardingProvider";
import {
    getDocsCommitSha,
    getGithubRepoData,
    getSitePublishUrl,
    saveDocsCommitSha,
    saveGithubRepoData,
    saveSitePublishUrl
} from "@/utils/onboardingSession";
import { clearRepoSetupResult } from "../repoSetupStorage";
import {
    fetchWorkflowStatus,
    getOrCreateRepoForPublishing,
    performCustomization,
    retryPublishingWorkflow
} from "./api";
import { handleWorkflowSuccess, sendSlackNotification } from "./completion-handlers";
import { FUN_LOADING_LABELS, POLL_INTERVAL_MS } from "./constants";
import type {
    PublishingPhase,
    PublishingStepStateMap,
    PublishingWorkflowActions,
    PublishingWorkflowState
} from "./types";

interface UsePublishingWorkflowProps {
    wizardFormData: WizardFormData;
    orgName?: string;
    onComplete?: (result: { url: string; fernDocsDownloadUrl?: string; githubRepoUrl?: string }) => void;
}

export function usePublishingWorkflow({
    wizardFormData,
    orgName,
    onComplete
}: UsePublishingWorkflowProps): PublishingWorkflowState & PublishingWorkflowActions {
    const [isComplete, setIsComplete] = useState(false);
    const [workflowFailed, setWorkflowFailed] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
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
    const [showSlowPublishingWarning, setShowSlowPublishingWarning] = useState(false);

    const onCompleteRef = useRef(onComplete);
    const hasStartedPublishing = useRef(false);
    const hasLinkedRepo = useRef(false);
    const hasNotifiedSlack = useRef(false);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    // Main publishing workflow - runs once on mount
    useEffect(() => {
        if (hasStartedPublishing.current || !orgName) {
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
                    saveSitePublishUrl(customizeResult.docsUrl);
                }

                // Notify Slack about docs onboarding completion
                if (!hasNotifiedSlack.current) {
                    hasNotifiedSlack.current = true;
                    sendSlackNotification(wizardFormData, repoResult, customizeResult.docsUrl);
                }

                // Clean up stored repo setup result
                clearRepoSetupResult(orgName);

                // Step 3: Start polling for workflow completion
                console.log("[LoaderScreen] Step 3: Polling workflow status...");

                // Cycle through fun labels before "Publishing site"
                let labelIndex = 0;
                setDocsStepLabel(FUN_LOADING_LABELS[0] || "Publishing site");

                // Cycle through labels every 2 seconds
                const labelInterval = setInterval(() => {
                    labelIndex++;
                    if (labelIndex < FUN_LOADING_LABELS.length) {
                        setDocsStepLabel(FUN_LOADING_LABELS[labelIndex] || "Publishing site");
                    } else {
                        clearInterval(labelInterval);
                    }
                }, 2000);

                setPublishingPhase("polling");
            } catch (err) {
                console.error("[LoaderScreen] Publishing error:", err);
                setError(err instanceof Error ? err.message : "An error occurred");
            }
        };

        runPublishing();
    }, [orgName, wizardFormData]);

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
            const response = await fetchWorkflowStatus(repoData.owner, repoData.repoName, commitSha ?? undefined);

            if (!response.ok) {
                console.log("[LoaderScreen] Poll response not ok:", response.status);
                return;
            }

            const status: WorkflowStatus = await response.json();
            console.log("[LoaderScreen] Workflow status:", status);

            if (status.status === "completed") {
                console.log("[LoaderScreen] Workflow completed with conclusion:", status.conclusion);

                if (status.conclusion === "success") {
                    const publishUrl = getSitePublishUrl();

                    // Link repo to docs site BEFORE showing completion UI.
                    // The docs URL is now registered in FDR (workflow ran `fern generate --docs`),
                    // so linking will succeed. We do this first to avoid a race condition where
                    // the user navigates away after seeing the completion UI but before linking finishes.
                    if (publishUrl && repoData.repoUrl && !hasLinkedRepo.current) {
                        await handleWorkflowSuccess(publishUrl, orgName ?? "", repoData.repoUrl, false);
                        hasLinkedRepo.current = true;
                    }

                    console.log("[LoaderScreen] Setting isComplete=true");
                    setIsComplete(true);
                    setStepStates((prev) => {
                        if (prev.github === "complete" && prev.docs === "complete") {
                            return prev;
                        }
                        return { github: "complete", docs: "complete" };
                    });

                    if (publishUrl) {
                        setDocsUrl((prev) => (prev === publishUrl ? prev : publishUrl));
                    }

                    if (onCompleteRef.current) {
                        onCompleteRef.current({
                            url: publishUrl || "",
                            githubRepoUrl: repoData.repoUrl
                        });
                    }
                } else {
                    setWorkflowFailed(true);
                    setStepStates((prev) => {
                        if (prev.github === "complete" && prev.docs === "failed") {
                            return prev;
                        }
                        return { github: "complete", docs: "failed" };
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
    }, [orgName]);

    // Only start polling when we're in the polling phase
    useEffect(() => {
        if (isComplete || workflowFailed || publishingPhase !== "polling") {
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
    }, [isComplete, workflowFailed, publishingPhase, pollWorkflowStatus]);

    // Show warning after 15 seconds of polling
    useEffect(() => {
        if (publishingPhase !== "polling" || isComplete || workflowFailed) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setShowSlowPublishingWarning(true);
        }, 15000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [publishingPhase, isComplete, workflowFailed]);

    const handleRetryWorkflow = useCallback(async () => {
        const repoData = getGithubRepoData();
        if (!repoData || !orgName) {
            return;
        }

        setIsRetrying(true);
        setWorkflowFailed(false);
        setStepStates({ github: "complete", docs: "in-progress" });
        setDocsStepLabel("Retrying...");

        try {
            await retryPublishingWorkflow(repoData.owner, repoData.repoName, orgName);
            setDocsStepLabel("Publishing site");
            setPublishingPhase("polling");
        } catch (err) {
            console.error("[LoaderScreen] Retry error:", err);
            setWorkflowFailed(true);
            setStepStates({ github: "complete", docs: "failed" });
            setError(err instanceof Error ? err.message : "Failed to retry workflow");
        } finally {
            setIsRetrying(false);
        }
    }, [orgName]);

    return {
        isComplete,
        workflowFailed,
        isRetrying,
        error,
        stepStates,
        githubRepoUrl,
        docsUrl,
        publishingPhase,
        docsStepLabel,
        isCollaboratorModalOpen,
        showSlowPublishingWarning,
        handleRetryWorkflow,
        setIsCollaboratorModalOpen
    };
}
