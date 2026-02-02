"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { usePostHog } from "posthog-js/react";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    markRepoSetupPending,
    storeRepoSetupError,
    storeRepoSetupSuccess
} from "@/components/onboarding/repoSetupStorage";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    generateRandomHash,
    sanitizeOrgIdInput,
    slugifyOrganizationName,
    validateOrganizationId,
    validateOrganizationName
} from "@/utils/organization";
import { SlideDownTransition } from "../transitions/SlideDownTransition";
import { SlideUpTransition } from "../transitions/SlideUpTransition";

interface CreateOrganizationFormProps {
    accessToken: string;
    onSuccess: (organizationId: string) => void;
    submitButtonText?: string;
    submitButtonClassName?: string;
    hideLabel?: boolean;
    initialOrganizationName?: string;
}

type OrgIdStatus = "idle" | "checking" | "available" | "unavailable" | "error" | "invalid";

export function CreateOrganizationForm({
    accessToken,
    onSuccess,
    submitButtonText = "Create Organization",
    hideLabel = false,
    submitButtonClassName = "w-full",
    initialOrganizationName
}: CreateOrganizationFormProps) {
    const [orgIdStatus, setOrgIdStatus] = useState<OrgIdStatus>("idle");
    const [orgIdError, setOrgIdError] = useState<string | null>(null);
    const [orgIdAutoMessage, setOrgIdAutoMessage] = useState<string | null>(null);
    const [isOrgIdEditing, setIsOrgIdEditing] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const availabilityRequestId = useRef(0);
    const posthog = usePostHog();

    const sanitizedInitialName = initialOrganizationName?.trim() ?? "";
    const initialOrgId = sanitizedInitialName ? slugifyOrganizationName(sanitizedInitialName) : "";

    const form = useForm({
        defaultValues: {
            organizationName: sanitizedInitialName,
            organizationId: initialOrgId,
            organizationIdSource: "auto" as "auto" | "manual"
        },
        onSubmit: async ({ value }) => {
            setSubmitError(null);
            try {
                const response = await fetch("/api/organization/create", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        organizationId: value.organizationId,
                        displayName: value.organizationName.trim() || undefined
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || "Failed to create organization");
                }

                const data = await response.json();

                // Track organization creation event
                captureEvent(posthog, PosthogEventName.ORGANIZATION_CREATED, {
                    organizationId: data.organizationId,
                    organizationName: value.organizationName.trim() || data.organizationId,
                    prepopulatedOrgName: sanitizedInitialName || undefined
                });

                // Fire-and-forget: start setting up the GitHub repo in the background
                // This will be ready by the time the user finishes the branding step
                const orgId = data.organizationId;
                markRepoSetupPending(orgId);

                void (async () => {
                    try {
                        const repoResponse = await fetch("/api/onboarding-docs/set-up-repo", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                orgName: orgId
                            })
                        });

                        if (repoResponse.ok) {
                            const repoData = await repoResponse.json();
                            storeRepoSetupSuccess(orgId, repoData.repoName, repoData.githubRepoUrl);
                            console.log("[CreateOrganizationForm] Repo setup complete:", repoData.repoName);
                        } else {
                            const errorData = await repoResponse.json().catch(() => ({}));
                            storeRepoSetupError(orgId, errorData.error || "Failed to set up repo");
                            console.warn("[CreateOrganizationForm] Repo setup failed:", errorData.error);
                        }
                    } catch (err) {
                        storeRepoSetupError(orgId, err instanceof Error ? err.message : "Unknown error");
                        console.warn("[CreateOrganizationForm] Failed to start repo setup:", err);
                    }
                })();

                onSuccess(data.organizationId);
            } catch (error) {
                setSubmitError(error instanceof Error ? error.message : "An error occurred");
            }
        }
    });

    const { organizationName, organizationId, organizationIdSource } = useStore(form.store, (state) => state.values);
    const { isSubmitting } = useStore(form.store, (state) => ({
        isSubmitting: state.isSubmitting
    }));

    const checkOrgIdAvailability = useCallback(async (candidateId: string): Promise<boolean> => {
        if (!candidateId) {
            return false;
        }

        const response = await fetch("/api/organization/check-availability", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ organizationId: candidateId })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(
                typeof data.error === "string" ? data.error : "Failed to check organization ID availability"
            );
        }

        return !data.exists;
    }, []);

    useEffect(() => {
        if (organizationIdSource !== "auto") {
            return;
        }

        const trimmedName = organizationName.trim();
        if (!trimmedName) {
            void form.setFieldValue("organizationId", "");
            setOrgIdStatus("idle");
            setOrgIdError(null);
            setOrgIdAutoMessage(null);
            return;
        }

        const baseId = slugifyOrganizationName(trimmedName);
        if (!baseId) {
            void form.setFieldValue("organizationId", "");
            setOrgIdStatus("invalid");
            setOrgIdError("Organization name must include letters or numbers to generate an ID.");
            setOrgIdAutoMessage(null);
            return;
        }

        const requestId = ++availabilityRequestId.current;
        void form.setFieldValue("organizationId", baseId);
        setOrgIdStatus("checking");
        setOrgIdError(null);
        setOrgIdAutoMessage(null);

        const generateUniqueOrgId = async () => {
            let candidate = baseId;
            let appendedHash = false;

            try {
                for (let attempt = 0; attempt < 5; attempt++) {
                    const available = await checkOrgIdAvailability(candidate);
                    if (availabilityRequestId.current !== requestId) {
                        return;
                    }
                    if (available) {
                        void form.setFieldValue("organizationId", candidate);
                        setOrgIdStatus("available");
                        setOrgIdError(null);
                        setOrgIdAutoMessage(
                            appendedHash ? "We added a unique suffix to keep this ID available." : null
                        );
                        return;
                    }

                    appendedHash = true;
                    candidate = `${baseId}-${generateRandomHash()}`;
                }

                if (availabilityRequestId.current !== requestId) {
                    return;
                }

                setOrgIdStatus("error");
                setOrgIdError("Unable to generate a unique org ID. Try editing it manually.");
            } catch (error) {
                if (availabilityRequestId.current !== requestId) {
                    return;
                }
                setOrgIdStatus("error");
                setOrgIdError(error instanceof Error ? error.message : "Failed to check ID availability.");
            }
        };

        void generateUniqueOrgId();
    }, [organizationName, organizationIdSource, checkOrgIdAvailability, form]);

    useEffect(() => {
        if (organizationIdSource !== "manual") {
            return;
        }

        setOrgIdAutoMessage(null);

        const validationError = validateOrganizationId(organizationId);

        if (validationError) {
            setOrgIdStatus("invalid");
            setOrgIdError(validationError);
            return;
        }

        const requestId = ++availabilityRequestId.current;
        setOrgIdStatus("checking");
        setOrgIdError(null);

        const timeoutId = window.setTimeout(async () => {
            try {
                const available = await checkOrgIdAvailability(organizationId);
                if (availabilityRequestId.current !== requestId) {
                    return;
                }

                if (available) {
                    setOrgIdStatus("available");
                    setOrgIdError(null);
                } else {
                    setOrgIdStatus("unavailable");
                    setOrgIdError("This org ID is already taken.");
                }
            } catch (error) {
                if (availabilityRequestId.current !== requestId) {
                    return;
                }
                setOrgIdStatus("error");
                setOrgIdError(error instanceof Error ? error.message : "Failed to check ID availability.");
            }
        }, 400);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [organizationId, organizationIdSource, checkOrgIdAvailability]);

    const handleToggleOrgIdEditing = () => {
        if (isOrgIdEditing) {
            setIsOrgIdEditing(false);
            return;
        }
        setIsOrgIdEditing(true);
        void form.setFieldValue("organizationIdSource", "manual");
        setOrgIdError(null);
    };

    const handleUseSuggestedOrgId = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        void form.setFieldValue("organizationIdSource", "auto");
        setIsOrgIdEditing(false);
        setOrgIdStatus("idle");
        setOrgIdError(null);
        setOrgIdAutoMessage(null);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setHasSubmitted(true);
        setSubmitError(null);

        if (orgIdStatus !== "available") {
            if (!organizationId) {
                setOrgIdError("Organization ID is required.");
            }
            return;
        }

        void form.handleSubmit();
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <form.Field
                name="organizationName"
                validators={{
                    onChange: ({ value }) => validateOrganizationName(value),
                    onSubmit: ({ value }) => validateOrganizationName(value)
                }}
            >
                {(field) => {
                    const showError =
                        field.state.meta.errors.length > 0 && (field.state.meta.isTouched || hasSubmitted);

                    return (
                        <div className="flex flex-col gap-1">
                            <div className="flex flex-col gap-2">
                                {(!hideLabel || isOrgIdEditing) && (
                                    <Label
                                        htmlFor="organization-name"
                                        className="text-muted-foreground text-sm font-normal"
                                    >
                                        Organization name <span className="text-destructive">*</span>
                                    </Label>
                                )}
                                <Input
                                    id="organization-name"
                                    type="text"
                                    value={field.state.value}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder="Plant Store"
                                    disabled={isSubmitting}
                                    className="w-full"
                                    aria-invalid={showError}
                                    aria-label={hideLabel ? "Organization name" : undefined}
                                />
                                {showError && <p className="text-xs text-destructive">{field.state.meta.errors[0]}</p>}
                                <div className="flex flex-wrap items-center gap-2">
                                    {!!organizationId && !isOrgIdEditing && (
                                        <>
                                            <p className="text-xs text-muted-foreground">
                                                Org ID will be <strong>{organizationId}</strong>
                                            </p>
                                            <button
                                                type="button"
                                                className="fern-link text-primary px-0 cursor-pointer font-bold text-xs"
                                                onClick={handleToggleOrgIdEditing}
                                            >
                                                Change
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <form.Field
                                name="organizationId"
                                validators={{
                                    onChange: ({ value }) =>
                                        organizationIdSource === "manual" ? validateOrganizationId(value) : undefined,
                                    onSubmit: ({ value }) => validateOrganizationId(value)
                                }}
                            >
                                {(fieldId) => (
                                    <SlideDownTransition show={isOrgIdEditing}>
                                        <div className="flex flex-col gap-1">
                                            <Label
                                                htmlFor="organization-id"
                                                className="text-muted-foreground text-sm font-normal"
                                            >
                                                Org ID
                                            </Label>

                                            <Input
                                                id="organization-id"
                                                type="text"
                                                value={fieldId.state.value}
                                                onChange={(event) => {
                                                    const sanitized = sanitizeOrgIdInput(event.target.value);
                                                    fieldId.handleChange(sanitized);
                                                    void form.setFieldValue("organizationIdSource", "manual");
                                                }}
                                                placeholder="plant-store"
                                                disabled={isSubmitting}
                                                aria-label="Organization ID"
                                            />

                                            <div className="flex items-center justify-between gap-2 pb-1">
                                                <div>
                                                    {orgIdAutoMessage && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {orgIdAutoMessage}
                                                        </p>
                                                    )}
                                                    {orgIdStatus === "checking" && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Checking if this org ID is available…
                                                        </p>
                                                    )}
                                                    {orgIdStatus === "available" && (
                                                        <p className="text-xs text-primary">
                                                            This org ID is available.
                                                        </p>
                                                    )}
                                                    {orgIdError ? (
                                                        <p className="text-xs text-destructive">{orgIdError}</p>
                                                    ) : fieldId.state.meta.errors[0] &&
                                                      organizationIdSource === "manual" ? (
                                                        <p className="text-xs text-destructive">
                                                            {fieldId.state.meta.errors[0]}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                <button
                                                    type="button"
                                                    className="fern-link fern-link--gray cursor-pointer font-bold text-xs"
                                                    onClick={handleUseSuggestedOrgId}
                                                >
                                                    Use suggested ID
                                                </button>
                                            </div>
                                        </div>
                                    </SlideDownTransition>
                                )}
                            </form.Field>
                        </div>
                    );
                }}
            </form.Field>

            {submitError && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                    <p>{submitError}</p>
                </div>
            )}

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, formIsSubmitting]) => (
                    <>
                        {(formIsSubmitting || (!!organizationName && canSubmit)) && (
                            <SlideUpTransition>
                                <Button
                                    type="submit"
                                    disabled={!canSubmit || orgIdStatus !== "available" || formIsSubmitting}
                                    loading={formIsSubmitting}
                                    className={submitButtonClassName}
                                >
                                    {submitButtonText}
                                </Button>
                            </SlideUpTransition>
                        )}
                    </>
                )}
            </form.Subscribe>
        </form>
    );
}
