import { useCallback, useState } from "react";
import type { WizardFormData } from "@/providers/OnboardingProvider";
import { uploadOnboardingAsset } from "./api";
import { DEFAULT_SPECS } from "./constants";
import { ensureUploadedImage, generateOrgIdFromDocsUrl, generateSessionId } from "./utils";

interface UseDocsSubmissionResult {
    submitDocs: (formData: WizardFormData) => Promise<void>;
    isSubmitting: boolean;
    sessionId: string | null;
    error: string | null;
    clearError: () => void;
}

/**
 * Hook for handling docs submission logic including file uploads and API calls
 *
 * @param organizationId - Optional organization ID for the submission (will be generated if not provided)
 * @returns Submission state and functions
 */
export function useDocsSubmission(organizationId?: string): UseDocsSubmissionResult {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const submitDocs = useCallback(
        async (formData: WizardFormData) => {
            // Generate organizationId from docs URL if not provided
            // The docs URL should correspond to the org name
            const effectiveOrgId = organizationId || generateOrgIdFromDocsUrl(formData.docsSiteUrl);

            setIsSubmitting(true);
            setError(null);

            // Generate a unique session ID for streaming
            const newSessionId = generateSessionId();
            setSessionId(newSessionId);

            try {
                // Create organization if it doesn't already exist (only if we generated the orgId)
                if (!organizationId) {
                    try {
                        const createOrgResponse = await fetch("/api/organization/create", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                organizationId: effectiveOrgId,
                                displayName: formData.docsSiteName
                            })
                        });

                        if (!createOrgResponse.ok) {
                            const errorData = await createOrgResponse.json();
                            // If org already exists, that's okay - user might be retrying
                            if (!errorData.error?.includes("already exists")) {
                                console.error("[useDocsSubmission] Failed to create organization:", errorData);
                                throw new Error(errorData.error || "Failed to create organization");
                            }
                        }
                    } catch (orgError) {
                        console.error("[useDocsSubmission] Organization creation error:", orgError);
                        // Only throw if it's not an "already exists" error
                        if (orgError instanceof Error && !orgError.message.includes("already exists")) {
                            throw orgError;
                        }
                    }
                }

                // Upload API spec files
                const uploadedSpecUrls: { fileName: string; assetUrl: string }[] = [];

                for (const file of formData.openApiSpecFiles) {
                    // Check if this is a default spec marker (empty file)
                    const defaultSpec = DEFAULT_SPECS.find((spec) => spec.fileName === file.name);
                    if (file.size === 0 && defaultSpec) {
                        uploadedSpecUrls.push({
                            fileName: file.name,
                            assetUrl: defaultSpec.assetUrl
                        });
                    } else {
                        const { assetUrl } = await uploadOnboardingAsset(file, effectiveOrgId);
                        uploadedSpecUrls.push({
                            fileName: file.name,
                            assetUrl
                        });
                    }
                }

                // Resolve image URLs - either upload files or use URLs from BrandFetch
                let resolvedFaviconUrl: string | null;
                let resolvedLogoUrl: string | null;

                // Favicon: prioritize file upload, otherwise use URL (will be uploaded if external)
                if (formData.faviconFile) {
                    const { assetUrl } = await uploadOnboardingAsset(formData.faviconFile, effectiveOrgId);
                    resolvedFaviconUrl = assetUrl;
                } else if (formData.faviconUrl) {
                    // Upload external URL to our S3 (from BrandFetch or other sources)
                    resolvedFaviconUrl = await ensureUploadedImage(
                        formData.faviconUrl,
                        "favicon-default.png",
                        effectiveOrgId
                    );
                } else {
                    resolvedFaviconUrl = null;
                }

                // Logo: prioritize file upload, otherwise use URL (will be uploaded if external)
                if (formData.logoFile) {
                    const { assetUrl } = await uploadOnboardingAsset(formData.logoFile, effectiveOrgId);
                    resolvedLogoUrl = assetUrl;
                } else if (formData.logoUrl) {
                    // Upload external URL to our S3 (from BrandFetch or other sources)
                    resolvedLogoUrl = await ensureUploadedImage(formData.logoUrl, "logo-default.png", effectiveOrgId);
                } else {
                    resolvedLogoUrl = null;
                }

                // Prepare final form data with all uploaded URLs
                const resolvedFormData = {
                    docsSiteName: formData.docsSiteName,
                    docsSiteUrl: formData.docsSiteUrl,
                    docsSiteUrlAvailable: formData.docsSiteUrlAvailable,
                    faviconUrl: resolvedFaviconUrl,
                    logoUrl: resolvedLogoUrl,
                    primaryColorHex: formData.primaryColorHex,
                    existingDocsSite: formData.existingDocsSite,
                    openApiSpecUrls: uploadedSpecUrls
                };

                // Submit to the onboarding API
                const requestBody = {
                    ...resolvedFormData,
                    orgName: effectiveOrgId,
                    sessionId: newSessionId
                };

                const response = await fetch("/api/onboarding-docs", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("[useDocsSubmission] API error:", errorData);
                    throw new Error(errorData.message || "Failed to create documentation");
                }

                // Response confirms streaming started
                // Actual results come through LoaderScreen's SSE connection
            } catch (err) {
                console.error("[useDocsSubmission] Error creating docs:", err);
                setError(err instanceof Error ? err.message : "An unexpected error occurred");
                setIsSubmitting(false);
                setSessionId(null);
                throw err; // Re-throw so caller can handle
            }
        },
        [organizationId]
    );

    return {
        submitDocs,
        isSubmitting,
        sessionId,
        error,
        clearError
    };
}
