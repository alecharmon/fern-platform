"use client";

import type { Json } from "@fern-platform/supabase";
import { useParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadOnboardingAsset } from "@/components/onboarding/api";
import { DEFAULT_SPECS } from "@/components/onboarding/constants";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { OpenAPISpecs } from "@/components/onboarding/OpenAPISpecs";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { useOnboarding } from "@/providers/OnboardingProvider";

interface ApiSpecStepClientProps {
    postmanOpenApiSpec: Json | null;
    postmanCollectionId: string | null;
    postmanTeamId: string | null;
}

export function ApiSpecStepClient({ postmanOpenApiSpec, postmanCollectionId, postmanTeamId }: ApiSpecStepClientProps) {
    const { form, formData, goToNextStep } = useOnboarding();
    const posthog = usePostHog();
    const params = useParams();
    const orgName = params.orgName as string;
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const hasAutopopulatedFromCollectionId = useRef(false);

    useEffect(() => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_VIEWED, {});
    }, [posthog]);

    useEffect(() => {
        if (postmanCollectionId) {
            form.setFieldValue("postmanCollectionId", postmanCollectionId);
        }
        if (postmanTeamId) {
            form.setFieldValue("postmanTeamId", postmanTeamId);
        }
    }, [postmanCollectionId, postmanTeamId, form]);

    const handleFilesChange = useCallback(
        async (files: File[]) => {
            // Store files for display
            form.setFieldValue("openApiSpecFiles", files);
            setUploadError(null);

            // Upload non-default files to S3 immediately
            const uploadedUrls: { fileName: string; assetUrl: string }[] = [];

            setIsUploading(true);
            try {
                for (const file of files) {
                    // Check if this is a default spec marker (empty file)
                    const defaultSpec = DEFAULT_SPECS.find((spec) => spec.fileName === file.name);
                    if (file.size === 0 && defaultSpec) {
                        uploadedUrls.push({
                            fileName: file.name,
                            assetUrl: defaultSpec.assetUrl
                        });
                    } else {
                        // Upload to S3
                        const { assetUrl } = await uploadOnboardingAsset(file, orgName);
                        uploadedUrls.push({
                            fileName: file.name,
                            assetUrl
                        });
                    }
                }
                // Store URLs for later use (survives sessionStorage serialization)
                form.setFieldValue("openApiSpecUrls", uploadedUrls);
            } catch (err) {
                console.error("Failed to upload API spec:", err);
                setUploadError(err instanceof Error ? err.message : "Failed to upload API spec");
            } finally {
                setIsUploading(false);
            }
        },
        [form, orgName]
    );

    useEffect(() => {
        if (postmanOpenApiSpec && !hasAutopopulatedFromCollectionId.current && formData.openApiSpecFiles.length === 0) {
            hasAutopopulatedFromCollectionId.current = true;
            const specJson = JSON.stringify(postmanOpenApiSpec, null, 2);
            const fileName = "collection.json";
            const file = new File([specJson], fileName, { type: "application/json" });
            handleFilesChange([file]);
        }
    }, [postmanOpenApiSpec, handleFilesChange, formData.openApiSpecFiles.length]);

    const hasUploadedFiles = formData.openApiSpecFiles.length > 0;

    const handleContinue = useCallback(async () => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_COMPLETED, {
            action: "continue",
            specCount: formData.openApiSpecFiles.length
        });

        goToNextStep();
    }, [formData.openApiSpecFiles, goToNextStep, posthog]);

    const handleSkip = useCallback(() => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_COMPLETED, {
            action: "skip",
            specCount: 0
        });

        goToNextStep();
    }, [goToNextStep, posthog]);

    return (
        <OnboardingStepCard
            title="Do you have an API spec?"
            description="Add your OpenAPI or AsyncAPI specs to view your API reference."
            onContinue={handleContinue}
            onSkip={handleSkip}
            showSkip
            hasData={hasUploadedFiles}
            isLoading={isUploading}
            error={uploadError}
        >
            <form.Field name="openApiSpecFiles">
                {(field: {
                    state: { value: File[]; meta: { errors: (string | undefined)[] } };
                    handleChange: (value: File[]) => void;
                    handleBlur: () => void;
                }) => (
                    <OpenAPISpecs
                        uploadedFiles={field.state.value}
                        setUploadedFiles={handleFilesChange}
                        validationError={
                            field.state.meta.errors.length > 0 && typeof field.state.meta.errors[0] === "string"
                                ? field.state.meta.errors[0]
                                : undefined
                        }
                        isFromPostman={postmanOpenApiSpec != null}
                    />
                )}
            </form.Field>
        </OnboardingStepCard>
    );
}
