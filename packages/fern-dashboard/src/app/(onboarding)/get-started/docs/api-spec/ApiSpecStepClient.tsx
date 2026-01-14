"use client";

import { useCallback } from "react";
import { DEFAULT_SPECS } from "@/components/onboarding/constants";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { OpenAPISpecs } from "@/components/onboarding/OpenAPISpecs";
import { useOnboarding } from "@/providers/OnboardingProvider";

export function ApiSpecStepClient() {
    const { form, formData, goToNextStep } = useOnboarding();

    const handleFilesChange = useCallback(
        async (files: File[]) => {
            form.setFieldValue("openApiSpecFiles", files);
            // Trigger validation to clear error when files are added
            await form.validateField("openApiSpecFiles", "change");
        },
        [form]
    );

    const handleAddDefaultSpecs = useCallback(() => {
        const defaultMarkerFiles = DEFAULT_SPECS.map((spec) => {
            const fileType = spec.fileName.endsWith(".json") ? "application/json" : "application/yaml";
            return new File([], spec.fileName, { type: fileType });
        });
        form.setFieldValue("openApiSpecFiles", defaultMarkerFiles);
    }, [form]);

    const handleContinue = useCallback(async () => {
        // Validate that at least one spec file is selected
        await form.validateField("openApiSpecFiles", "change");

        const fieldMeta = form.getFieldMeta("openApiSpecFiles");
        if (fieldMeta?.errors && fieldMeta.errors.length > 0) {
            // Validation failed, don't proceed
            return;
        }

        goToNextStep();
    }, [form, goToNextStep]);

    const handleSkip = useCallback(() => {
        // When skipping, add default specs and proceed
        if (formData.openApiSpecFiles.length === 0) {
            handleAddDefaultSpecs();
        }
        goToNextStep();
    }, [formData.openApiSpecFiles.length, handleAddDefaultSpecs, goToNextStep]);

    return (
        <OnboardingStepCard
            title="Do you have an API spec?"
            description="Add your OpenAPI or AsyncAPI specs to view your API reference."
            onContinue={handleContinue}
            onSkip={handleSkip}
            showSkip
        >
            <form.Field
                name="openApiSpecFiles"
                validators={{
                    onChange: ({ value }: { value: File[] }) => {
                        if (!value || value.length === 0) {
                            return "Please upload at least one API spec";
                        }
                        return undefined;
                    }
                }}
            >
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
