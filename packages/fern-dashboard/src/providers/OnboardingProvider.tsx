"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { validateWizardForm } from "@/components/onboarding/validation";

export interface WizardFormData {
    docsSiteName: string;
    docsSiteUrl: string;
    docsSiteUrlAvailable: boolean | null;
    // URLs from BrandFetch or final uploaded URLs
    faviconUrl: string | null;
    logoUrl: string | null;
    // File objects from user uploads (will be uploaded during submission)
    faviconFile: File | null;
    logoFile: File | null;
    // Original filenames for uploaded files (to preserve extension info)
    faviconFileName: string | null;
    logoFileName: string | null;
    primaryColorHex: string | null;
    existingDocsSite: string;
    // File objects for API specs (will be uploaded during submission)
    openApiSpecFiles: File[];
    // Final asset URLs after upload (used for submission)
    openApiSpecUrls: { fileName: string; assetUrl: string }[];
    // Tracks successful site publication - required to access complete page
    sitePublishUrl: string | null;
}

export type OnboardingStep = "branding" | "api-spec" | "details" | "publishing" | "complete";

export interface ValidationErrors {
    docsSiteName?: string;
    docsSiteUrl?: string;
    primaryColorHex?: string;
    openApiSpecFiles?: string;
}

interface OnboardingContextValue {
    // Form management
    form: ReturnType<typeof useForm<WizardFormData>>;
    formData: WizardFormData;
    validationErrors: ValidationErrors;
    validateForm: () => boolean;

    // Backward compatibility
    updateFormData: (updates: Partial<WizardFormData>) => void;
    resetFormData: () => void;

    // Step navigation
    currentStep: OnboardingStep;
    goToNextStep: (options?: { replace?: boolean }) => void;
    goToPreviousStep: () => void;
    skipStep: () => void;
    setStep: (step: OnboardingStep, options?: { replace?: boolean }) => void;
}

const DEFAULT_FORM_DATA: WizardFormData = {
    docsSiteName: "",
    docsSiteUrl: "",
    docsSiteUrlAvailable: null,
    faviconUrl:
        "https://cdn.brandfetch.io/idPXovIzxA/w/400/h/400/id6bO_yJUx.png?c=1bxid64Mup7aczewSAYMX&t=1745869970633",
    logoUrl: "https://cdn.brandfetch.io/idPXovIzxA/w/400/h/400/id6bO_yJUx.png?c=1bxid64Mup7aczewSAYMX&t=1745869970633",
    faviconFile: null,
    logoFile: null,
    faviconFileName: null,
    logoFileName: null,
    primaryColorHex: null,
    existingDocsSite: "",
    openApiSpecFiles: [],
    openApiSpecUrls: [],
    sitePublishUrl: null
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const STEP_ORDER: OnboardingStep[] = ["branding", "api-spec", "details", "publishing", "complete"];

const STEP_ROUTES: Record<OnboardingStep, string> = {
    branding: "/get-started/docs",
    "api-spec": "/get-started/docs/api-spec",
    details: "/get-started/docs/details",
    publishing: "/get-started/docs/publishing",
    complete: "/get-started/docs/complete"
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [currentStep, setCurrentStep] = useState<OnboardingStep>("branding");
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [isNavigating, setIsNavigating] = useState(false);

    // Initialize form with @tanstack/react-form
    const form = useForm<WizardFormData>({
        defaultValues: DEFAULT_FORM_DATA
    });

    // Extract form values from store
    const formData = useStore(form.store, (state) => state.values);

    // Sync currentStep with the current URL pathname
    useEffect(() => {
        // Find the step that matches the current pathname
        const matchedStep = (Object.entries(STEP_ROUTES) as [OnboardingStep, string][]).find(
            ([_step, route]) => pathname === route
        );

        if (matchedStep) {
            const [step] = matchedStep;
            // Only update if different to avoid unnecessary re-renders
            if (step !== currentStep) {
                setCurrentStep(step);
            }
        }
    }, [pathname, currentStep]);

    // Validation function
    const validateForm = useCallback(() => {
        const errors = validateWizardForm(formData);
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData]);

    // Backward compatibility: updateFormData using form.setFieldValue
    const updateFormData = useCallback(
        (updates: Partial<WizardFormData>) => {
            Object.entries(updates).forEach(([key, value]) => {
                form.setFieldValue(key as keyof WizardFormData, value as WizardFormData[keyof WizardFormData]);
            });
        },
        [form]
    );

    // Reset form to default values
    const resetFormData = useCallback(() => {
        Object.entries(DEFAULT_FORM_DATA).forEach(([key, value]) => {
            form.setFieldValue(key as keyof WizardFormData, value as WizardFormData[keyof WizardFormData]);
        });
        setValidationErrors({});
    }, [form]);

    const setStep = useCallback(
        (step: OnboardingStep, options?: { replace?: boolean }) => {
            // Prevent concurrent navigation
            if (isNavigating) {
                console.warn("[OnboardingProvider] setStep blocked - already navigating");
                return;
            }

            // Safeguard: prevent accessing "complete" step without successful publication
            // Check the current form store state directly for the most up-to-date value
            const currentFormState = form.store.state.values;
            if (step === "complete" && !currentFormState.sitePublishUrl) {
                console.warn(
                    "[OnboardingProvider] Attempted to navigate to complete page without successful site publication"
                );
                return;
            }

            setIsNavigating(true);
            // Don't manually set currentStep - let the useEffect sync it from the URL
            // Use replace for publishing and complete steps to prevent back navigation
            const shouldReplace = options?.replace ?? (step === "publishing" || step === "complete");

            if (shouldReplace) {
                router.replace(STEP_ROUTES[step]);
            } else {
                router.push(STEP_ROUTES[step]);
            }

            // Reset navigation lock after a short delay to allow router to process
            setTimeout(() => setIsNavigating(false), 500);
        },
        [router, isNavigating, form.store]
    );

    const goToNextStep = useCallback(
        (options?: { replace?: boolean }) => {
            // Prevent concurrent navigation
            if (isNavigating) {
                console.warn("[OnboardingProvider] Navigation already in progress, skipping");
                return;
            }

            const currentIndex = STEP_ORDER.indexOf(currentStep);
            if (currentIndex >= 0 && currentIndex < STEP_ORDER.length - 1) {
                const nextStep = STEP_ORDER[currentIndex + 1];
                if (nextStep) {
                    setStep(nextStep, options);
                }
            }
        },
        [currentStep, setStep, isNavigating]
    );

    const goToPreviousStep = useCallback(() => {
        // Prevent concurrent navigation
        if (isNavigating) {
            return;
        }

        const currentIndex = STEP_ORDER.indexOf(currentStep);
        if (currentIndex > 0) {
            const prevStep = STEP_ORDER[currentIndex - 1];
            if (prevStep) {
                setStep(prevStep);
            }
        }
    }, [currentStep, setStep, isNavigating]);

    const skipStep = useCallback(() => {
        // Prevent concurrent navigation
        if (isNavigating) {
            return;
        }

        // Skipping behaves the same as going to next step
        // Individual components can handle skip logic (e.g., setting defaults)
        goToNextStep();
    }, [goToNextStep, isNavigating]);

    const value = useMemo(
        () => ({
            // Form management
            form,
            formData,
            validationErrors,
            validateForm,
            // Backward compatibility
            updateFormData,
            resetFormData,
            // Step navigation
            currentStep,
            goToNextStep,
            goToPreviousStep,
            skipStep,
            setStep
        }),
        [
            form,
            formData,
            validationErrors,
            validateForm,
            updateFormData,
            resetFormData,
            currentStep,
            goToNextStep,
            goToPreviousStep,
            skipStep,
            setStep
        ]
    );

    return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (context === undefined) {
        throw new Error("useOnboarding must be used within an OnboardingProvider");
    }
    return context;
}
