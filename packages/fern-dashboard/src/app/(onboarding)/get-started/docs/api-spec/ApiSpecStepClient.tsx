"use client";

import { useCallback } from "react";
import { DEFAULT_SPECS } from "@/components/onboarding/constants";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { OpenAPISpecs } from "@/components/onboarding/OpenAPISpecs";
import { useOnboarding } from "@/providers/OnboardingProvider";

export function ApiSpecStepClient() {
    const { form, formData, goToNextStep } = useOnboarding();

    const handleFilesChange = useCallback(
        (files: File[]) => {
            form.setFieldValue("openApiSpecFiles", files);
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

    // Both skip and continue actions add the default specs if no specs are present and continue
    const handleContinue = useCallback(() => {
        // Validate that at least one spec file is selected
        if (formData.openApiSpecFiles.length === 0) {
            handleAddDefaultSpecs();
        }
        goToNextStep();
    }, [formData.openApiSpecFiles.length, handleAddDefaultSpecs, goToNextStep]);

    return (
        <OnboardingStepCard
            title="Upload your API spec"
            description="Add your OpenAPI, AsyncAPI, gRPC, or other API specification."
            onContinue={handleContinue}
            onSkip={handleContinue}
            showSkip
        >
            <OpenAPISpecs uploadedFiles={formData.openApiSpecFiles} setUploadedFiles={handleFilesChange} />
        </OnboardingStepCard>
    );
}
