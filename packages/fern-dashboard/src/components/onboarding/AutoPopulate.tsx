"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding, type WizardFormData } from "@/providers/OnboardingProvider";

interface AutoPopulateProps {
    onApplyUpdates: (updates: Partial<WizardFormData>) => void;
}

export function AutoPopulate({ onApplyUpdates }: AutoPopulateProps) {
    const { form } = useOnboarding();
    const [isLoading, setIsLoading] = useState(false);

    const handleAutoPopulate = useCallback(
        async (domain: string) => {
            if (!domain.trim()) {
                form.setFieldMeta("existingDocsSite", (prev: { errors: string[] }) => ({
                    ...prev,
                    errors: ["Please enter a domain"]
                }));
                return;
            }

            setIsLoading(true);
            // Clear any previous errors
            form.setFieldMeta("existingDocsSite", (prev: { errors: string[] }) => ({
                ...prev,
                errors: []
            }));

            try {
                const response = await fetch("/api/brand-assets/auto-populate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier: domain })
                });

                if (!response.ok) {
                    const { error: message } = (await response.json().catch(() => ({}))) as { error?: string };
                    form.setFieldMeta("existingDocsSite", (prev: { errors: string[] }) => ({
                        ...prev,
                        errors: [message ?? "Failed to fetch brand assets"]
                    }));
                    return;
                }

                const result = (await response.json()) as { updates: Partial<WizardFormData> };

                if (result.updates && Object.keys(result.updates).length > 0) {
                    onApplyUpdates(result.updates);
                }
            } catch (err) {
                console.error("Error auto-populating from BrandFetch:", err);
                form.setFieldMeta("existingDocsSite", (prev: { errors: string[] }) => ({
                    ...prev,
                    errors: [err instanceof Error ? err.message : "An unexpected error occurred"]
                }));
            } finally {
                setIsLoading(false);
            }
        },
        [form, onApplyUpdates]
    );

    return (
        <form.Field name="existingDocsSite">
            {(field: {
                state: { value: string; meta: { errors: (string | undefined)[] } };
                handleChange: (value: string) => void;
                handleBlur: () => void;
            }) => (
                <div className="flex flex-col gap-2">
                    <Label htmlFor="auto-populate-company-site">Marketing or docs site</Label>
                    <div className="relative">
                        <Input
                            id="auto-populate-company-site"
                            type="text"
                            placeholder="myorg.com"
                            value={field.state.value}
                            onChange={(e) => {
                                field.handleChange(e.target.value);
                            }}
                            onBlur={() => {
                                field.handleBlur();
                                if (field.state.value.trim()) {
                                    void handleAutoPopulate(field.state.value);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (field.state.value.trim()) {
                                        void handleAutoPopulate(field.state.value);
                                    }
                                }
                            }}
                            disabled={isLoading}
                        />
                        {isLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2Icon className="h-4 w-4 animate-spin text-gray-800" />
                            </div>
                        )}
                    </div>
                    {isLoading && <p className="text-gray-1100 text-xs">Fetching brand assets...</p>}
                    {field.state.meta.errors.length > 0 && (
                        <p className="text-xs text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
                    )}
                </div>
            )}
        </form.Field>
    );
}
