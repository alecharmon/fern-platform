"use client";

import { useCallback } from "react";
import { AutoPopulate } from "@/components/onboarding/AutoPopulate";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { useOnboarding, type WizardFormData } from "@/providers/OnboardingProvider";

export function BrandingStepClient() {
    const { form, formData, goToNextStep } = useOnboarding();

    const handleApplyUpdates = useCallback(
        (updates: Partial<WizardFormData>) => {
            // Use form.setFieldValue for each field update
            Object.entries(updates).forEach(([key, value]) => {
                form.setFieldValue(key as keyof WizardFormData, value as WizardFormData[keyof WizardFormData]);
            });
        },
        [form]
    );

    const handleContinue = useCallback(async () => {
        // Validate the existingDocsSite field (this is where the domain is stored)
        await form.validateField("existingDocsSite", "change");

        const fieldMeta = form.getFieldMeta("existingDocsSite");
        if (fieldMeta?.errors && fieldMeta?.errors?.length > 0) {
            // Validation failed, don't proceed
            return;
        }

        // Proceed to next step
        goToNextStep();
    }, [form, goToNextStep]);

    const handleSkip = useCallback(() => {
        // Skip to next step (no validation required)
        goToNextStep();
    }, [goToNextStep]);

    return (
        <OnboardingStepCard
            title="What is your current company site?"
            description="We'll automatically fetch your brand assets. You will get a chance to review and adjust them later."
            onContinue={handleContinue}
            onSkip={handleSkip}
            showSkip
        >
            <AutoPopulate onApplyUpdates={handleApplyUpdates} />

            {/* Show a preview of what was populated */}
            {(formData.logoUrl || formData.primaryColorHex) && (
                <div className="mt-6 space-y-4">
                    <h3 className="text-gray-1200 text-sm font-medium">Populated assets:</h3>
                    <div className="space-y-2">
                        {formData.logoUrl && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-gray-500 bg-white p-1">
                                    {/* biome-ignore lint/performance/noImgElement: false positive */}
                                    <img src={formData.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                                </div>
                                <span className="text-gray-1100 text-sm">Logo</span>
                            </div>
                        )}
                        {formData.primaryColorHex && (
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-12 w-12 rounded-lg border border-gray-500"
                                    style={{ backgroundColor: formData.primaryColorHex }}
                                />
                                <span className="text-gray-1100 text-sm">
                                    Primary color: {formData.primaryColorHex}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </OnboardingStepCard>
    );
}
