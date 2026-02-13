"use client";

import { Loader2Icon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkDocsUrlAvailability } from "@/app/actions/docsWizard";
import { ColorPicker } from "@/components/onboarding/ColorPicker";
import { DocsUrl } from "@/components/onboarding/DocsUrl";
import { OnboardingStepCard } from "@/components/onboarding/OnboardingStepCard";
import { UploadImage } from "@/components/onboarding/UploadImage";
import { nameToUrl } from "@/components/onboarding/validation";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { SlideDownTransition } from "@/components/transitions/SlideDownTransition";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding, type WizardFormData } from "@/providers/OnboardingProvider";
import { saveOnboardingFormData, saveOnboardingSession, saveSitePublishUrl } from "@/utils/onboardingSession";
import { generateRandomHash } from "@/utils/organization";

interface DetailsStepClientProps {
    organizationId: string;
}

export function DetailsStepClient({ organizationId }: DetailsStepClientProps) {
    const { form, formData, validationErrors, validateForm, setStep, setFocusedField } = useOnboarding();
    const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
    const [isAutoPopulating, setIsAutoPopulating] = useState(false);
    const posthog = usePostHog();
    const hasTrackedView = useRef(false);
    const autoDocsUrlRequestId = useRef(0);
    const lastAutoDocsUrl = useRef<string | null>(null);
    const docsUrlSource = formData.docsSiteUrlSource ?? "auto";
    const isDocsUrlEditing = docsUrlSource === "manual";
    const hasSiteTitle = formData.docsSiteName.trim().length > 0;
    const generatedDocsUrl = hasSiteTitle ? nameToUrl(formData.docsSiteName) : "";
    const displayDocsUrl = hasSiteTitle ? formData.docsSiteUrl || generatedDocsUrl : "";
    const docsDomainSuffix = ".docs.buildwithfern.com";
    const formattedDocsUrl =
        displayDocsUrl.length > 0
            ? `${displayDocsUrl.includes(docsDomainSuffix) ? displayDocsUrl : `${displayDocsUrl}${docsDomainSuffix}`}`
            : "";
    const shouldShowDocsUrlInput = hasSiteTitle && (isDocsUrlEditing || Boolean(validationErrors.docsSiteUrl));

    // On mount: log posthog event and set default values if needed.
    useEffect(() => {
        if (!hasTrackedView.current) {
            captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_DETAILS_STEP_VIEWED, {});
            hasTrackedView.current = true;
            const normalizedOrgName = organizationId?.trim();
            if (!hasSiteTitle && normalizedOrgName) {
                form.setFieldValue("docsSiteName", normalizedOrgName);
                if (docsUrlSource === "auto") {
                    const autoUrl = nameToUrl(normalizedOrgName);
                    form.setFieldValue("docsSiteUrl", autoUrl);
                    form.setFieldValue("docsSiteUrlAvailable", null);
                }
            }
        }
    }, [form, hasSiteTitle, organizationId, posthog, docsUrlSource]);

    useEffect(() => {
        if (docsUrlSource === "auto" && formData.docsSiteUrl && formData.docsSiteUrlAvailable === true) {
            lastAutoDocsUrl.current = formData.docsSiteUrl;
        }
    }, [docsUrlSource, formData.docsSiteUrl, formData.docsSiteUrlAvailable]);

    const handleSubmit = useCallback(() => {
        // Validate form with current formData
        if (!validateForm()) {
            console.error("Validation failed:", validationErrors);
            console.error("Form data:", formData);
            return;
        }

        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_DETAILS_STEP_SUBMITTED, {
            docsSiteUrl: formData.docsSiteUrl,
            hasLogoUrl: !!formData.logoUrl,
            hasPrimaryColor: !!formData.primaryColorHex
        });

        // Save form data to sessionStorage for the publishing page
        // Note: Backend will add default API specs if openApiSpecUrls is empty
        saveOnboardingFormData(formData);

        // Save expected docs URL
        const expectedDocsUrl = formData.docsSiteUrl.includes(".docs.buildwithfern.com")
            ? `https://${formData.docsSiteUrl}`
            : `https://${formData.docsSiteUrl}.docs.buildwithfern.com`;
        saveSitePublishUrl(expectedDocsUrl);

        // Save onboarding session for PublishingStepClient
        const sessionId = `publish-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        saveOnboardingSession(sessionId, organizationId);

        // Navigate immediately - publishing page handles async work
        setStep("publishing");
    }, [formData, posthog, validateForm, validationErrors, setStep, organizationId]);

    const handleLogoUpload = useCallback(
        (file: File) => {
            setLogoUploadError(null);

            // Create a blob URL for preview (no S3 upload needed)
            const blobUrl = URL.createObjectURL(file);

            // Store the blob URL for preview and file for later base64 conversion
            form.setFieldValue("logoUrl", blobUrl);
            form.setFieldValue("logoFileName", file.name);
            form.setFieldValue("logoFile", file);
        },
        [form]
    );

    const handleLogoRemove = useCallback(() => {
        form.setFieldValue("logoUrl", null);
        form.setFieldValue("logoFileName", null);
        form.setFieldValue("logoFile", null);
    }, [form]);

    const ensureAutoDocsUrlAvailability = useCallback(
        async (baseSlug: string, requestId: number) => {
            if (!baseSlug) {
                form.setFieldValue("docsSiteUrl", "");
                form.setFieldValue("docsSiteUrlAvailable", null);
                return;
            }

            let candidate = baseSlug;

            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    const result = await checkDocsUrlAvailability(candidate);
                    if (autoDocsUrlRequestId.current !== requestId) {
                        return;
                    }

                    if (result.available) {
                        form.setFieldValue("docsSiteUrl", candidate);
                        form.setFieldValue("docsSiteUrlAvailable", true);
                        lastAutoDocsUrl.current = candidate;
                        return;
                    }
                } catch (error) {
                    if (autoDocsUrlRequestId.current !== requestId) {
                        return;
                    }
                    console.error("Failed to check docs URL availability:", error);
                    break;
                }

                candidate = `${baseSlug}-${generateRandomHash()}`;
            }

            if (autoDocsUrlRequestId.current !== requestId) {
                return;
            }

            form.setFieldValue("docsSiteUrlSource", "manual");
            form.setFieldValue("docsSiteUrl", candidate);
            form.setFieldValue("docsSiteUrlAvailable", false);
            lastAutoDocsUrl.current = null;
            setFocusedField("url");
        },
        [form, setFocusedField]
    );

    const handleSiteTitleChange = useCallback(
        (newName: string) => {
            form.setFieldValue("docsSiteName", newName);
            lastAutoDocsUrl.current = null;

            if (docsUrlSource === "auto") {
                const nextUrl = nameToUrl(newName);
                form.setFieldValue("docsSiteUrl", nextUrl);
                form.setFieldValue("docsSiteUrlAvailable", null);
            }
        },
        [docsUrlSource, form]
    );

    const handleStartEditingDocsUrl = useCallback(() => {
        autoDocsUrlRequestId.current += 1;
        form.setFieldValue("docsSiteUrlSource", "manual");
        form.setFieldValue("docsSiteUrlAvailable", null);
        setFocusedField("url");
    }, [form, setFocusedField]);

    const handleUseSuggestedDocsUrl = useCallback(() => {
        if (!generatedDocsUrl || docsUrlSource === "auto") {
            return;
        }

        const suggestedUrl = lastAutoDocsUrl.current ?? generatedDocsUrl;

        form.setFieldValue("docsSiteUrl", suggestedUrl);
        form.setFieldValue("docsSiteUrlSource", "auto");
        form.setFieldValue("docsSiteUrlAvailable", lastAutoDocsUrl.current ? true : null);
        setFocusedField("none");
    }, [docsUrlSource, form, generatedDocsUrl, setFocusedField]);

    useEffect(() => {
        if (docsUrlSource !== "auto") {
            return;
        }

        const candidateSlug = formData.docsSiteUrl?.trim() || generatedDocsUrl;

        if (!hasSiteTitle || !candidateSlug) {
            if (formData.docsSiteUrl !== "") {
                form.setFieldValue("docsSiteUrl", "");
            }
            if (formData.docsSiteUrlAvailable !== null) {
                form.setFieldValue("docsSiteUrlAvailable", null);
            }
            lastAutoDocsUrl.current = null;
            return;
        }

        if (formData.docsSiteUrl !== candidateSlug) {
            form.setFieldValue("docsSiteUrl", candidateSlug);
        }

        if (formData.docsSiteUrlAvailable === true && lastAutoDocsUrl.current === candidateSlug) {
            return;
        }

        if (formData.docsSiteUrlAvailable !== null) {
            form.setFieldValue("docsSiteUrlAvailable", null);
        }

        const requestId = ++autoDocsUrlRequestId.current;
        void ensureAutoDocsUrlAvailability(candidateSlug, requestId);
    }, [
        docsUrlSource,
        ensureAutoDocsUrlAvailability,
        form,
        formData.docsSiteUrl,
        formData.docsSiteUrlAvailable,
        generatedDocsUrl,
        hasSiteTitle
    ]);

    const handleAutoPopulate = useCallback(
        async (domain: string) => {
            if (!domain.trim()) {
                return;
            }

            setIsAutoPopulating(true);

            try {
                const response = await fetch("/api/brand-assets/auto-populate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier: domain })
                });

                if (!response.ok) {
                    return;
                }

                const result = (await response.json()) as { updates: Partial<WizardFormData> };

                if (result.updates && Object.keys(result.updates).length > 0) {
                    Object.entries(result.updates).forEach(([key, value]) => {
                        form.setFieldValue(key as keyof WizardFormData, value as WizardFormData[keyof WizardFormData]);
                    });
                }
            } catch (err) {
                console.error("Error auto-populating from BrandFetch:", err);
            } finally {
                setIsAutoPopulating(false);
            }
        },
        [form]
    );

    return (
        <OnboardingStepCard
            title="Set up your Docs"
            description="You can always change these settings later."
            continueText="Publish"
            onContinue={handleSubmit}
            showSkip={false}
        >
            <div className="space-y-6">
                {/* Site Name & Docs URL */}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="company-site" className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">
                        Site title
                    </Label>
                    <Input
                        id="company-site"
                        type="text"
                        placeholder="Your Company"
                        value={formData.docsSiteName}
                        onChange={(e) => handleSiteTitleChange(e.target.value)}
                        onFocus={() => setFocusedField("title")}
                        onBlur={() => setFocusedField("none")}
                        className="w-full"
                    />
                    {validationErrors.docsSiteName && (
                        <p className="text-xs text-red-600">{validationErrors.docsSiteName}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        {formattedDocsUrl ? (
                            <>
                                {docsUrlSource === "auto" && !shouldShowDocsUrlInput && (
                                    <>
                                        <p className="text-xs text-gray-1000">
                                            Your domain will be <strong>{formattedDocsUrl}</strong>
                                        </p>
                                        <button
                                            type="button"
                                            className="fern-link text-primary px-0 text-xs font-semibold cursor-pointer"
                                            onClick={handleStartEditingDocsUrl}
                                        >
                                            Change
                                        </button>
                                    </>
                                )}
                            </>
                        ) : (
                            <p className="text-xs text-gray-1000">Enter a site title to generate your docs URL.</p>
                        )}
                    </div>
                    <SlideDownTransition show={shouldShowDocsUrlInput}>
                        <div className="flex flex-col gap-2">
                            <DocsUrl
                                value={formData.docsSiteUrl}
                                onChange={(url, available) => {
                                    form.setFieldValue("docsSiteUrl", url);
                                    form.setFieldValue("docsSiteUrlAvailable", available);
                                    if (docsUrlSource !== "manual") {
                                        form.setFieldValue("docsSiteUrlSource", "manual");
                                    }
                                }}
                                onFocus={() => setFocusedField("url")}
                                onBlur={() => setFocusedField("none")}
                            />
                            <div className="flex flex-wrap items-start justify-start gap-2">
                                {docsUrlSource === "manual" && generatedDocsUrl && (
                                    <button
                                        type="button"
                                        className="fern-link fern-link--gray px-0 mb-1 text-xs font-semibold cursor-pointer"
                                        onClick={handleUseSuggestedDocsUrl}
                                    >
                                        Use suggested domain
                                    </button>
                                )}
                            </div>
                        </div>
                    </SlideDownTransition>
                    {validationErrors.docsSiteUrl && (
                        <p className="text-xs text-red-600">{validationErrors.docsSiteUrl}</p>
                    )}
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-border p-4 pt-3">
                    {/* Auto-populate from existing site */}
                    <div className="flex flex-col gap-2">
                        <Label
                            htmlFor="auto-populate-site"
                            className="text-gray-1200 dark:text-gray-1100 text-sm font-normal"
                        >
                            Find assets from your current site
                        </Label>
                        <div className="relative">
                            <Input
                                id="auto-populate-site"
                                type="text"
                                value={formData.existingDocsSite}
                                placeholder="your-company.com"
                                onChange={(e) => form.setFieldValue("existingDocsSite", e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (formData.existingDocsSite.trim()) {
                                            void handleAutoPopulate(formData.existingDocsSite);
                                        }
                                    }
                                }}
                                disabled={isAutoPopulating}
                                className="w-full"
                            />
                            {isAutoPopulating ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2Icon className="h-4 w-4 animate-spin text-gray-800" />
                                </div>
                            ) : (
                                <>
                                    {formData.existingDocsSite.trim().length > 0 && (
                                        <p className="text-xs text-muted-foreground text-right absolute right-3 top-1/2 -translate-y-1/2">
                                            Enter to search
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
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
                        description="Recommended height of 60 pixels, used as the main logo on the top-left corner."
                        imageUrl={formData.logoUrl}
                        onFileSelect={handleLogoUpload}
                        onRemove={handleLogoRemove}
                        size="large"
                        accept="image/png,image/gif,image/svg+xml"
                        onFocus={() => setFocusedField("logo")}
                        onBlur={() => setFocusedField("none")}
                    />
                    {logoUploadError && <p className="text-xs text-red-600">{logoUploadError}</p>}
                </div>
            </div>
        </OnboardingStepCard>
    );
}
