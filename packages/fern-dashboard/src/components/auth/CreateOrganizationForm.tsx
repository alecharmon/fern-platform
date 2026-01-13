"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateOrgFormData {
    organizationId: string;
    displayName: string;
}

interface CreateOrganizationFormProps {
    accessToken: string;
    onSuccess: (organizationId: string) => void;
    submitButtonText?: string;
    submitButtonClassName?: string;
}

function validateOrganizationId(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
        return "Organization ID is required.";
    }
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
        return "Use lowercase letters, numbers, and hyphens only.";
    }
    if (/--/.test(trimmed)) {
        return "Consecutive hyphens are not allowed.";
    }
    if (/^-|-$/.test(trimmed)) {
        return "Cannot start or end with a hyphen.";
    }
    return undefined;
}

export function CreateOrganizationForm({
    accessToken,
    onSuccess,
    submitButtonText = "Create Organization",
    submitButtonClassName = "w-full"
}: CreateOrganizationFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const form = useForm<CreateOrgFormData>({
        defaultValues: {
            organizationId: "",
            displayName: ""
        },
        onSubmit: async ({ value }) => {
            setSubmitError(null);
            setIsSubmitting(true);

            try {
                const response = await fetch("/api/organization/create", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        organizationId: value.organizationId,
                        displayName: value.displayName || undefined
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to create organization");
                }

                const data = await response.json();
                onSuccess(data.organizationId);
            } catch (err) {
                setSubmitError(err instanceof Error ? err.message : "An error occurred");
                setIsSubmitting(false);
            }
        }
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            className="space-y-6"
        >
            <form.Field
                name="organizationId"
                validators={{
                    onChange: ({ value }) => validateOrganizationId(value),
                    onSubmit: ({ value }) => validateOrganizationId(value)
                }}
            >
                {(field) => (
                    <div className="flex flex-col gap-2">
                        <Label
                            htmlFor="organizationId"
                            className="text-gray-1200 dark:text-gray-1100 text-sm font-normal"
                        >
                            Organization ID <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="organizationId"
                            type="text"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="my-organization"
                            disabled={isSubmitting}
                            className="w-full"
                            aria-invalid={field.state.meta.errors.length > 0}
                        />
                        <p className="text-xs text-muted-foreground">
                            This will be used in URLs and cannot be changed later. Use lowercase letters, numbers, and
                            hyphens.
                        </p>
                        {field.state.meta.errors[0] && (
                            <p className="text-xs text-red-600">{field.state.meta.errors[0]}</p>
                        )}
                    </div>
                )}
            </form.Field>

            <form.Field name="displayName">
                {(field) => (
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="displayName" className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">
                            Display name
                        </Label>
                        <Input
                            id="displayName"
                            type="text"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="My Organization"
                            disabled={isSubmitting}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">Optional: A friendly name for your organization</p>
                    </div>
                )}
            </form.Field>

            {submitError && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                    <p>{submitError}</p>
                </div>
            )}

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                    <Button
                        type="submit"
                        disabled={!canSubmit || isSubmitting}
                        loading={isSubmitting}
                        className={submitButtonClassName}
                    >
                        {submitButtonText}
                    </Button>
                )}
            </form.Subscribe>
        </form>
    );
}
