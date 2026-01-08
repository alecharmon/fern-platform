"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";
import { ColorPicker } from "@/components/onboarding/ColorPicker";
import { DocsUrl } from "@/components/onboarding/DocsUrl";
import { LoaderScreen } from "@/components/onboarding/LoaderScreen";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { UploadImage } from "@/components/onboarding/UploadImage";
import { useDocsSubmission } from "@/components/onboarding/useDocsSubmission";
import { generateOrgIdFromDocsUrl } from "@/components/onboarding/utils";
import { nameToUrl } from "@/components/onboarding/validation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "@/providers/OnboardingProvider";

export function DetailsStepClient() {
    const { form, formData, validationErrors, validateForm, goToNextStep } = useOnboarding();
    const { submitDocs, isSubmitting, sessionId, error } = useDocsSubmission();

    const handleSubmit = useCallback(async () => {
        // Validate form with current formData
        if (!validateForm()) {
            console.error("Validation failed:", validationErrors);
            console.error("Form data:", formData);
            return;
        }

        try {
            // Use shared submission hook
            await submitDocs(formData);
        } catch (err) {
            // Error is handled by the hook
            console.error("Submission error:", err);
        }
    }, [formData, submitDocs, validateForm, validationErrors]);

    const handleStreamComplete = useCallback(
        (result: { url: string; fernDocsDownloadUrl?: string; githubRepoUrl?: string }) => {
            // Store the published URL in form state to enable access to complete page
            form.setFieldValue("sitePublishUrl", result.url);

            // Navigate to confirmation screen
            goToNextStep();
        },
        [goToNextStep, form]
    );

    // Show loader screen during submission
    if (isSubmitting && sessionId) {
        // Generate org name from docs URL for the loader screen
        const orgName = generateOrgIdFromDocsUrl(formData.docsSiteUrl);

        return (
            <AnimatePresence mode="wait">
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
                        sessionId={sessionId}
                        onComplete={handleStreamComplete}
                    />
                </motion.div>
            </AnimatePresence>
        );
    }

    return (
        <OnboardingStepCard
            title="Set up your Docs"
            description="You can always change your settings later."
            onContinue={handleSubmit}
            showSkip={false}
            isLoading={isSubmitting}
            error={error}
        >
            <div className="space-y-6">
                {/* Site Name */}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="company-site" className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">
                        Site title
                    </Label>
                    <Input
                        id="company-site"
                        type="text"
                        placeholder="Your Company"
                        value={formData.docsSiteName}
                        onChange={(e) => {
                            const newName = e.target.value;
                            form.setFieldValue("docsSiteName", newName);
                            // Auto-update URL if not manually changed
                            if (!formData.docsSiteUrl || formData.docsSiteUrl === nameToUrl(formData.docsSiteName)) {
                                form.setFieldValue("docsSiteUrl", nameToUrl(newName));
                            }
                        }}
                        className="w-full"
                    />
                    {validationErrors.docsSiteName && (
                        <p className="text-xs text-red-600">{validationErrors.docsSiteName}</p>
                    )}
                </div>

                {/* Docs URL */}
                <div className="flex flex-col gap-1">
                    <DocsUrl
                        value={formData.docsSiteUrl}
                        onChange={(url, available) => {
                            form.setFieldValue("docsSiteUrl", url);
                            form.setFieldValue("docsSiteUrlAvailable", available);
                        }}
                    />
                    {validationErrors.docsSiteUrl && (
                        <p className="text-xs text-red-600">{validationErrors.docsSiteUrl}</p>
                    )}
                </div>

                {/* Primary Color */}
                <div className="flex flex-col gap-1">
                    <ColorPicker
                        label="Primary color"
                        color={formData.primaryColorHex}
                        onColorChange={(color) => form.setFieldValue("primaryColorHex", color)}
                    />
                    {validationErrors.primaryColorHex && (
                        <p className="text-xs text-red-600">{validationErrors.primaryColorHex}</p>
                    )}
                </div>

                {/* Favicon */}
                <UploadImage
                    label="Favicon"
                    description="Upload a 32 x 32 pixel ICO, PNG, GIF, or JPG to display in browser tabs."
                    imageUrl={formData.faviconUrl}
                    onFileSelect={(file) => {
                        form.setFieldValue("faviconFile", file);
                        // Create a preview URL for the uploaded file
                        const previewUrl = URL.createObjectURL(file);
                        form.setFieldValue("faviconUrl", previewUrl);
                    }}
                    size="small"
                    accept="image/x-icon,image/png,image/gif"
                />

                {/* Logo */}
                <UploadImage
                    label="Logo"
                    description="This will be used as the main logo on the top-left corner of the Docs site."
                    imageUrl={formData.logoUrl}
                    onFileSelect={(file) => {
                        form.setFieldValue("logoFile", file);
                        // Create a preview URL for the uploaded file
                        const previewUrl = URL.createObjectURL(file);
                        form.setFieldValue("logoUrl", previewUrl);
                    }}
                    size="large"
                    accept="image/png,image/gif,image/svg+xml"
                />
            </div>
        </OnboardingStepCard>
    );
}
