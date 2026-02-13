"use client";

import { useParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useState } from "react";
import { uploadOnboardingAsset } from "@/components/onboarding/api";
import { DEFAULT_SPECS } from "@/components/onboarding/constants";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { OpenAPISpecs } from "@/components/onboarding/OpenAPISpecs";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { useOnboarding } from "@/providers/OnboardingProvider";

export function ApiSpecStepClient() {
    const { form, formData, goToNextStep } = useOnboarding();
    const posthog = usePostHog();
    const params = useParams();
    const orgName = params.orgName as string;
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_VIEWED, {});
    }, [posthog]);

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

    const handleAddDefaultSpecs = useCallback(() => {
        const defaultMarkerFiles = DEFAULT_SPECS.map((spec) => {
            const fileType = spec.fileName.endsWith(".json") ? "application/json" : "application/yaml";
            return new File([], spec.fileName, { type: fileType });
        });
        form.setFieldValue("openApiSpecFiles", defaultMarkerFiles);
        // Also set the URLs for default specs (no upload needed)
        form.setFieldValue(
            "openApiSpecUrls",
            DEFAULT_SPECS.map((spec) => ({
                fileName: spec.fileName,
                assetUrl: spec.assetUrl
            }))
        );
    }, [form]);

    const isUsingDefaultSpecs = useCallback((files: File[]) => {
        if (files.length !== DEFAULT_SPECS.length) {
            return false;
        }
        return files.every((file) => DEFAULT_SPECS.some((spec) => spec.fileName === file.name));
    }, []);

    const hasUploadedFiles = formData.openApiSpecFiles.length > 0;

    const handleContinue = useCallback(async () => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_COMPLETED, {
            action: "continue",
            specCount: formData.openApiSpecFiles.length,
            usedDefaultSpecs: isUsingDefaultSpecs(formData.openApiSpecFiles)
        });

        goToNextStep();
    }, [formData.openApiSpecFiles, goToNextStep, isUsingDefaultSpecs, posthog]);

    const handleSkip = useCallback(() => {
        // When skipping, add default specs and proceed
        const willUseDefaults = formData.openApiSpecFiles.length === 0;
        if (willUseDefaults) {
            handleAddDefaultSpecs();
        }

        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_COMPLETED, {
            action: "skip",
            specCount: willUseDefaults ? DEFAULT_SPECS.length : formData.openApiSpecFiles.length,
            usedDefaultSpecs: willUseDefaults || isUsingDefaultSpecs(formData.openApiSpecFiles)
        });

        goToNextStep();
    }, [formData.openApiSpecFiles, handleAddDefaultSpecs, goToNextStep, isUsingDefaultSpecs, posthog]);

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
                    />
                )}
            </form.Field>
        </OnboardingStepCard>
    );
}
