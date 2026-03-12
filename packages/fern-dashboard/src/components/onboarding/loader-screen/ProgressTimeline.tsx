"use client";

import { AppWindow } from "lucide-react";
import { PublishingStepCard } from "@/components/onboarding/PublishingStepCard";
import { cn } from "@/utils/utils";
import { GithubLogo } from "../../auth/GithubLogo";
import type { PublishingStepDefinition } from "./constants";
import type { PublishingStepStateMap } from "./types";

const PUBLISHING_STEPS: PublishingStepDefinition[] = [
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
        inProgressActionLabel: "Publishing site",
        icon: <AppWindow className="h-5 w-5" />
    }
];

function getLineColor(state: string | null): string {
    if (state === "complete") {
        return "bg-green-500";
    }
    if (state === "failed") {
        return "bg-red-500";
    }
    if (state === "in-progress") {
        return "bg-primary";
    }
    return "bg-gray-200 dark:bg-gray-800";
}

interface ProgressTimelineProps {
    stepStates: PublishingStepStateMap;
    docsStepLabel: string;
    docsUrl: string | null;
    onAddCollaboratorClick: () => void;
}

export function ProgressTimeline({
    stepStates,
    docsStepLabel,
    docsUrl,
    onAddCollaboratorClick
}: ProgressTimelineProps) {
    return (
        <div className="w-full max-w-3xl space-y-5">
            {PUBLISHING_STEPS.map((step, index) => {
                const state = stepStates[step.id];
                const previousState = index > 0 ? stepStates[PUBLISHING_STEPS[index - 1]!.id] : null;
                const nextState =
                    index < PUBLISHING_STEPS.length - 1 ? stepStates[PUBLISHING_STEPS[index + 1]!.id] : null;

                const currentLineColor = getLineColor(state);
                const topLineColor = previousState === "complete" ? "bg-green-500" : "bg-gray-200 dark:bg-gray-800";
                const bottomLineColor = nextState === "complete" ? "bg-green-500" : "bg-gray-200 dark:bg-gray-800";

                const actionUrl = step.id === "docs" ? docsUrl : undefined;
                const isActionDisabled = step.id === "docs" && state !== "complete";
                const onActionClick = step.id === "github" ? onAddCollaboratorClick : undefined;

                return (
                    <div key={step.id} className="flex items-stretch gap-4">
                        <div className="flex w-4 flex-col items-center self-stretch">
                            {index > 0 && <div className={cn("w-1 flex-1 rounded-full", topLineColor)} />}
                            <div className={cn("w-1 rounded-full", currentLineColor)} style={{ minHeight: "100%" }} />
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
                                inProgressActionLabel={step.id === "docs" ? docsStepLabel : step.inProgressActionLabel}
                                completeActionUrl={actionUrl ?? undefined}
                                isActionDisabled={isActionDisabled}
                                onActionClick={onActionClick}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
