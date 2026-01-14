"use client";

import { CodeWidget } from "@/components/onboarding/CodeWidget";
import { useOnboarding } from "@/providers/OnboardingProvider";

export function CodeWidgetPreview() {
    const { formData, focusedField } = useOnboarding();
    return <CodeWidget wizardFormData={formData} focusArea={focusedField} />;
}
