"use client";

import { useCallback, useEffect, useState } from "react";
import { uploadOnboardingAsset } from "@/components/onboarding/api";
import { ColorPicker } from "@/components/onboarding/ColorPicker";
import { DocsUrl } from "@/components/onboarding/DocsUrl";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { UploadImage } from "@/components/onboarding/UploadImage";
import { useDocsSubmission } from "@/components/onboarding/useDocsSubmission";
import { generateOrgIdFromDocsUrl } from "@/components/onboarding/utils";
import { nameToUrl } from "@/components/onboarding/validation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { saveOnboardingFormData, saveOnboardingSession } from "@/utils/onboardingSession";

export function DetailsStepClient() {
    const { form, formData, validationErrors, validateForm, goToNextStep } = useOnboarding();
    const { submitDocs, isSubmitting, sessionId, error } = useDocsSubmission();
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

    // When sessionId is set (submission started), save to sessionStorage and navigate to publishing
    useEffect(() => {
        if (sessionId && isSubmitting) {
            const orgName = generateOrgIdFromDocsUrl(formData.docsSiteUrl);

            // Save session data to sessionStorage
            saveOnboardingSession(sessionId, orgName);
            saveOnboardingFormData(formData);

            // Navigate to publishing step
            goToNextStep();
        }
    }, [sessionId, isSubmitting, formData, goToNextStep]);

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

            // After successful submission, save session data and navigate to publishing
            // Note: sessionId is set by submitDocs when submission starts
        } catch (err) {
            // Error is handled by the hook
            console.error("Submission error:", err);
        }
    }, [formData, submitDocs, validateForm, validationErrors]);

    const handleLogoUpload = useCallback(
        async (file: File) => {
            setIsUploadingLogo(true);
            setLogoUploadError(null);

            try {
                // Generate org ID from current docs URL for upload
                const orgId = generateOrgIdFromDocsUrl(formData.docsSiteUrl);

                // Upload file to S3
                const { assetUrl } = await uploadOnboardingAsset(file, orgId);

                // Store the S3 URL and filename in form state
                form.setFieldValue("logoUrl", assetUrl);
                form.setFieldValue("logoFileName", file.name);
                form.setFieldValue("logoFile", file); // Keep file for reference
            } catch (err) {
                console.error("Failed to upload logo:", err);
                setLogoUploadError(err instanceof Error ? err.message : "Failed to upload logo");
            } finally {
                setIsUploadingLogo(false);
            }
        },
        [form, formData.docsSiteUrl]
    );

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

                {/* TODO: Favicon to an advanced configuration step */}
                {/* <UploadImage
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
                /> */}

                {/* Logo */}
                <UploadImage
                    label="Logo"
                    description="Recommended height of 60 pixels. This will be used as the main logo on the top-left corner of the Docs site."
                    imageUrl={formData.logoUrl}
                    onFileSelect={handleLogoUpload}
                    size="large"
                    accept="image/png,image/gif,image/svg+xml"
                />
                {logoUploadError && <p className="text-xs text-red-600">{logoUploadError}</p>}
                {isUploadingLogo && <p className="text-xs text-gray-600">Uploading logo...</p>}
            </div>
        </OnboardingStepCard>
    );
}
