import type { PublishingStepState } from "@/components/onboarding/PublishingStepCard";

export type PublishingStepId = "github" | "docs";

export type PublishingStepStateMap = Record<PublishingStepId, PublishingStepState>;

export type PublishingPhase = "repo" | "customizing" | "polling" | "complete";

export interface RepoResult {
    owner: string;
    repoName: string;
    githubRepoUrl: string;
}

export interface CustomizeResult {
    commitSha?: string;
    docsUrl?: string;
}

export interface PublishingWorkflowState {
    isComplete: boolean;
    workflowFailed: boolean;
    isRetrying: boolean;
    error: string | null;
    stepStates: PublishingStepStateMap;
    githubRepoUrl: string | null;
    docsUrl: string | null;
    publishingPhase: PublishingPhase;
    docsStepLabel: string;
    isCollaboratorModalOpen: boolean;
    showSlowPublishingWarning: boolean;
}

export interface PublishingWorkflowActions {
    handleRetryWorkflow: () => Promise<void>;
    setIsCollaboratorModalOpen: (open: boolean) => void;
}
