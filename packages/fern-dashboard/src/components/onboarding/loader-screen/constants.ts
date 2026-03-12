import type { ReactNode } from "react";

export const POLL_INTERVAL_MS = 2000;

export const FUN_LOADING_LABELS = [
    "Tending the garden",
    "Planting a Fern",
    "Adding your colors",
    "Thanking our robots",
    "Publishing site"
] as const;

export interface PublishingStepDefinition {
    id: "github" | "docs";
    title: string;
    completeActionLabel: string;
    inProgressActionLabel: string;
    icon: ReactNode;
}
