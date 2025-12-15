"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import type { WizardFormData } from "./page";

interface AutoPopulateProps {
    onApplyUpdates: (updates: Partial<WizardFormData>) => void;
}

export default function AutoPopulate({ onApplyUpdates }: AutoPopulateProps) {
    const orgName = useOrgNameFromPathname();
    const [domain, setDomain] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAutoPopulate = useCallback(async () => {
        if (!domain.trim()) {
            setError("Please enter a domain");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/brand-assets/auto-populate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: domain, organizationId: orgName })
            });

            if (!response.ok) {
                const { error: message } = (await response.json().catch(() => ({}))) as { error?: string };
                setError(message ?? "Failed to fetch brand assets");
                return;
            }

            const result = (await response.json()) as { updates: Partial<WizardFormData> };

            if (result.updates && Object.keys(result.updates).length > 0) {
                onApplyUpdates(result.updates);
            }
        } catch (err) {
            console.error("Error auto-populating from BrandFetch:", err);
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, [domain, orgName, onApplyUpdates]);

    // Debounce effect - auto-fetch after user stops typing
    // biome-ignore lint/correctness/useExhaustiveDependencies: handleAutoPopulate causes infinite re-renders if included
    useEffect(() => {
        if (!domain.trim()) {
            return;
        }

        const timeoutId = setTimeout(() => {
            void handleAutoPopulate();
        }, 800); // 800ms delay

        return () => clearTimeout(timeoutId);
    }, [domain]);

    return (
        <div className="flex flex-col gap-5 rounded-md border border-gray-500 bg-gray-300 p-3">
            <div className="flex items-center justify-center gap-2">
                <SparklesIcon className="text-gray-1100 h-4 w-4" />
                <h3 className="text-gray-1200 text-sm font-normal">Auto-populate branding</h3>
            </div>

            <div className="flex flex-col gap-2">
                <Label
                    htmlFor="auto-populate-company-site"
                    className="text-gray-1200 dark:text-gray-1100 text-sm font-normal"
                >
                    Your company site (optional)
                </Label>
                <div className="relative">
                    <Input
                        id="auto-populate-company-site"
                        type="text"
                        placeholder="myorg.com"
                        value={domain}
                        onChange={(e) => {
                            setDomain(e.target.value);
                            setError(null);
                        }}
                        disabled={isLoading}
                        className="dark:bg-b w-full bg-gray-200 pr-10"
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2Icon className="h-4 w-4 animate-spin text-gray-800" />
                        </div>
                    )}
                </div>
                {isLoading && <p className="text-gray-1100 text-xs">Fetching brand assets...</p>}
                {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>
        </div>
    );
}
