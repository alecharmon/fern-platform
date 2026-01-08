"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { ConfirmScreen } from "@/components/onboarding/ConfirmScreen";
import { LoaderScreen } from "@/components/onboarding/LoaderScreen";
import { useDocsSubmission } from "@/components/onboarding/useDocsSubmission";
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { useOnboarding, type WizardFormData } from "@/providers/OnboardingProvider";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import UploadForm from "./UploadForm";

// Re-export for backward compatibility
export type { WizardFormData };

export default function NewDocsWizardPage() {
    const orgName = useOrgNameFromPathname();
    const { form, formData, validationErrors, validateForm } = useOnboarding();
    const { submitDocs, isSubmitting, sessionId, error } = useDocsSubmission(orgName);
    const [currentStep, setCurrentStep] = useState<"docsSiteInfo" | "confirmation">("docsSiteInfo");
    const [showExitDialog, setShowExitDialog] = useState(false);

    const handleExitClick = useCallback(() => {
        setShowExitDialog(true);
    }, []);

    const handleSubmitForm = useCallback(
        async (values: WizardFormData) => {
            if (currentStep === "docsSiteInfo") {
                // Validate form before submitting
                if (!validateForm()) {
                    return;
                }

                try {
                    // Submit using shared hook
                    await submitDocs(values);
                } catch (err) {
                    // Error is already handled by the hook
                    console.error("Submission error:", err);
                }
            }
        },
        [currentStep, submitDocs, validateForm]
    );

    const handleStreamComplete = useCallback(() => {
        // Navigate to confirmation screen
        setCurrentStep("confirmation");
    }, []);

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden">
            {/* Radial gradient background */}
            <div className="bg-gradient-radial pointer-events-none absolute inset-0 from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black" />

            {/* Blurred green blob */}
            <svg
                className="pointer-events-none absolute"
                style={{
                    width: "1351px",
                    height: "525px",
                    left: "-90px",
                    bottom: "197px"
                }}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1001 656"
                fill="none"
            >
                <g opacity="0.1" filter="url(#filter0_f_wizard)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_wizard"
                        x="0"
                        y="0"
                        width="1000.09"
                        height="655.083"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                        <feGaussianBlur stdDeviation="66" result="effect1_foregroundBlur" />
                    </filter>
                </defs>
            </svg>

            {/* Header with Fern logo, step indicator, and close button */}
            <div className="relative z-10 w-full p-4">
                <div className="flex items-center justify-between">
                    <button onClick={handleExitClick} className="cursor-pointer">
                        <ThemedFernLogo className="w-16" />
                    </button>
                    <button
                        onClick={handleExitClick}
                        className="rounded-xs cursor-pointer p-2 opacity-70 transition-opacity hover:opacity-100"
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <AnimatePresence mode="wait">
                {isSubmitting ? (
                    <motion.div
                        key="loaderScreen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="relative z-10 flex w-full flex-1 items-center justify-center"
                    >
                        <LoaderScreen
                            wizardFormData={formData}
                            orgName={orgName}
                            showLogs={true}
                            sessionId={sessionId || undefined}
                            onComplete={handleStreamComplete}
                        />
                    </motion.div>
                ) : currentStep === "docsSiteInfo" ? (
                    <motion.div
                        key="uploadForm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="relative z-10 flex w-full flex-1 flex-col items-center"
                    >
                        <UploadForm
                            form={form}
                            formData={formData}
                            validationErrors={validationErrors}
                            onSubmitForm={handleSubmitForm}
                            isLoading={isSubmitting}
                            error={error}
                        />
                    </motion.div>
                ) : currentStep === "confirmation" ? (
                    <motion.div
                        key="confirmScreen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="relative z-10 flex w-full flex-1"
                    >
                        <ConfirmScreen orgName={orgName} docsUrl={formData.docsSiteUrl} wizardFormData={formData} />
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {/* Exit confirmation dialog */}
            <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Exit wizard?</DialogTitle>
                        <DialogDescription className="pb-10">
                            Are you sure you want to exit? Your progress will not be saved.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowExitDialog(false)}>
                            Cancel
                        </Button>
                        <Button variant="default" asChild>
                            <Link href={`/${orgName}`}>Exit</Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
