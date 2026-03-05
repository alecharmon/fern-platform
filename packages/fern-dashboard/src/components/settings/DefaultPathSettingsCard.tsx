"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getDomainSettings, setDomainDefaultBasepath } from "@/app/actions/domainSettings";
import type { Auth0OrgName } from "@/app/services/auth0/types";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

interface DefaultPathSettingsContentProps {
    domain: string;
    orgName: Auth0OrgName;
    basepaths: string[];
}

type CardState = { status: "loading" } | { status: "loaded"; currentValue: string } | { status: "error" };

export function DefaultPathSettingsContent({ domain, orgName, basepaths }: DefaultPathSettingsContentProps) {
    const [cardState, setCardState] = useState<CardState>({ status: "loading" });
    const [inputValue, setInputValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            const settings = await getDomainSettings({ domain, orgName });
            const current = settings?.defaultBasepath ?? "";
            setCardState({ status: "loaded", currentValue: current });
            setInputValue(current);
        } catch {
            setCardState({ status: "error" });
        }
    }, [domain, orgName]);

    useEffect(() => {
        void fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDomainDefaultBasepath({ domain, orgName, defaultBasepath: inputValue.trim() });
            const normalized =
                inputValue.trim() === ""
                    ? ""
                    : inputValue.trim().startsWith("/")
                      ? inputValue.trim()
                      : `/${inputValue.trim()}`;
            setCardState({ status: "loaded", currentValue: normalized });
            setInputValue(normalized);
            toast.success(normalized ? "Default path saved" : "Default path removed");
        } catch {
            toast.error("Failed to save default path");
        } finally {
            setIsSaving(false);
        }
    };

    const currentValue = cardState.status === "loaded" ? cardState.currentValue : "";
    const hasChanged = cardState.status === "loaded" && inputValue.trim() !== currentValue;

    return (
        <div className="flex flex-col gap-3">
            <div className="text-muted-foreground text-sm">
                In your multi-source set-up, if users go to {domain}, we will send them to {domain}
                {inputValue || "/..."} instead. This applies to all sources under this domain.
            </div>

            {cardState.status === "loading" && (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-9 w-full" />
                    <div className="flex justify-end">
                        <Skeleton className="h-9 w-20" />
                    </div>
                </div>
            )}

            {cardState.status === "error" && (
                <div className="text-sm text-destructive">
                    Failed to load default path configuration.{" "}
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
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">{domain}</span>
                        <Input
                            type="text"
                            placeholder="/docs"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && hasChanged) {
                                    void handleSave();
                                }
                            }}
                            className="flex-1"
                        />
                    </div>
                    {basepaths.length > 0 && (
                        <div className="text-muted-foreground text-xs">Available paths: {basepaths.join(", ")}</div>
                    )}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => {
                                void handleSave();
                            }}
                            disabled={!hasChanged || isSaving}
                            className="w-20 gap-2"
                        >
                            {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
