"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getDomainSettings, type SearchBehavior, setDomainSearchBehavior } from "@/app/actions/domainSettings";
import type { Auth0OrgName } from "@/app/services/auth0/types";

import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Skeleton } from "../ui/skeleton";

interface SearchBehaviorSettingsCardProps {
    domain: string;
    orgName: Auth0OrgName;
}

type CardState = { status: "loading" } | { status: "loaded"; currentValue: SearchBehavior } | { status: "error" };

export function SearchBehaviorSettingsCard({ domain, orgName }: SearchBehaviorSettingsCardProps) {
    const [cardState, setCardState] = useState<CardState>({ status: "loading" });
    const [isSaving, setIsSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            const settings = await getDomainSettings({ domain, orgName });
            const current: SearchBehavior = settings?.searchBehavior ?? "hierarchical";
            setCardState({ status: "loaded", currentValue: current });
        } catch {
            setCardState({ status: "error" });
        }
    }, [domain, orgName]);

    useEffect(() => {
        void fetchSettings();
    }, [fetchSettings]);

    const handleChange = async (value: SearchBehavior) => {
        if (cardState.status !== "loaded" || value === cardState.currentValue) {
            return;
        }
        setIsSaving(true);
        try {
            await setDomainSearchBehavior({ domain, orgName, searchBehavior: value });
            setCardState({ status: "loaded", currentValue: value });
            toast.success("Search behavior updated");
        } catch {
            toast.error("Failed to update search behavior");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="text-muted-foreground text-sm">
                Controls how Ask Fern and search behave across sub-paths on this domain.
            </div>

            {cardState.status === "loading" && (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-48" />
                </div>
            )}

            {cardState.status === "error" && (
                <div className="text-sm text-destructive">
                    Failed to load search behavior configuration.{" "}
                    <button
                        className="cursor-pointer underline underline-offset-2"
                        onClick={() => {
                            setCardState({ status: "loading" });
                            void fetchSettings();
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {cardState.status === "loaded" && (
                <RadioGroup
                    value={cardState.currentValue}
                    onValueChange={(v) => void handleChange(v as SearchBehavior)}
                    disabled={isSaving}
                    className="gap-4"
                >
                    <div className="flex items-start gap-3">
                        <RadioGroupItem value="hierarchical" id="search-hierarchical" className="mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                            <Label htmlFor="search-hierarchical" className="cursor-pointer font-medium">
                                Hierarchical
                            </Label>
                            <span className="text-muted-foreground text-xs">
                                Searches under /subpath will only show results from /subpath and below
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <RadioGroupItem value="unified" id="search-unified" className="mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                            <Label htmlFor="search-unified" className="cursor-pointer font-medium">
                                Unified
                            </Label>
                            <span className="text-muted-foreground text-xs">
                                Searches under any sub-path will aggregate results from all sub-paths
                            </span>
                        </div>
                    </div>
                    {isSaving && (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Loader2Icon className="size-3 animate-spin" />
                            Saving...
                        </div>
                    )}
                </RadioGroup>
            )}
        </div>
    );
}
