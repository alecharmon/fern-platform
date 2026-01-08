"use client";

import { CodeWidget } from "@/components/onboarding/CodeWidget";
import { useOnboarding } from "@/providers/OnboardingProvider";

export function CodeWidgetPreview() {
    const { formData } = useOnboarding();
    return <CodeWidget wizardFormData={formData} />;
}
