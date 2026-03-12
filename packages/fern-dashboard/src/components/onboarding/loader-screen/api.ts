import type { WizardFormData } from "@/providers/OnboardingProvider";
import { getRepoSetupResult, waitForRepoSetup } from "../repoSetupStorage";
import { blobUrlToBase64, fileToBase64 } from "./file-utils";
import type { CustomizeResult, RepoResult } from "./types";

/**
 * Extracts the owner from a GitHub repo URL.
 * E.g., "https://github.com/fern-support/my-repo" -> "fern-support"
 */
function extractOwnerFromUrl(githubRepoUrl: string): string {
    const urlParts = githubRepoUrl.split("/");
    return urlParts[urlParts.length - 2] || "";
}

/**
 * Gets or creates the repo for publishing.
 *
 * Three scenarios:
 * 1. Repo was pre-created at org creation -> success in localStorage -> use it
 * 2. Repo setup is pending -> wait for it (up to 45s)
 * 3. No repo setup happened (existing org, or failed) -> create on-demand
 */
export async function getOrCreateRepoForPublishing(orgName: string): Promise<RepoResult> {
    // Check localStorage for pre-created repo
    const storedResult = getRepoSetupResult(orgName);

    // Case 1: Repo already created
    if (storedResult?.status === "success" && storedResult.repoName && storedResult.githubRepoUrl) {
        console.log("[getOrCreateRepo] Using pre-created repo:", storedResult.repoName);
        const owner = extractOwnerFromUrl(storedResult.githubRepoUrl);
        return { owner, repoName: storedResult.repoName, githubRepoUrl: storedResult.githubRepoUrl };
    }

    // Case 2: Repo setup in progress - wait for it
    if (storedResult?.status === "pending") {
        console.log("[getOrCreateRepo] Repo setup in progress, waiting...");
        const result = await waitForRepoSetup(orgName, 45000);
        if (result) {
            console.log("[getOrCreateRepo] Repo setup completed:", result.repoName);
            const owner = extractOwnerFromUrl(result.githubRepoUrl);
            return { owner, ...result };
        }
        console.log("[getOrCreateRepo] Timed out waiting for repo, will create now");
        // If wait times out, fall through to create on-demand
    }

    // Case 3: No repo setup happened (existing org) or failed - create on-demand
    console.log("[getOrCreateRepo] Creating repo on-demand...");
    const response = await fetch("/api/onboarding-docs/set-up-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create repository");
    }

    const data = await response.json();
    const owner = extractOwnerFromUrl(data.githubRepoUrl);
    console.log("[getOrCreateRepo] Repo created:", data.repoName);
    return { owner, repoName: data.repoName, githubRepoUrl: data.githubRepoUrl };
}

/**
 * Resolves logo or favicon data to base64 if available.
 * Returns the base64 data and filename, or null if not available.
 */
async function resolveAssetToBase64(
    file: File | null,
    url: string | null,
    fileName: string | null,
    defaultFileName: string
): Promise<{ data: string; fileName: string } | null> {
    if (file) {
        const data = await fileToBase64(file);
        return { data, fileName: fileName || file.name };
    }

    if (url?.startsWith("blob:")) {
        // Blob URL from BrandFetch - fetch and convert
        const data = await blobUrlToBase64(url);
        return { data, fileName: fileName || defaultFileName };
    }

    return null;
}

/**
 * Performs customization: reads files as base64 and calls the customize API.
 * Logo/favicon are sent as base64 data directly to avoid S3 upload.
 * API specs are pre-uploaded to S3 in the API spec step, URLs are in formData.openApiSpecUrls.
 */
export async function performCustomization(
    formData: WizardFormData,
    repoData: { repoName: string; githubRepoUrl: string },
    orgName: string
): Promise<CustomizeResult> {
    // API spec URLs are already uploaded in the API spec step
    const uploadedSpecUrls = formData.openApiSpecUrls ?? [];
    console.log(
        `[performCustomization] openApiSpecUrls: ${uploadedSpecUrls.length} specs`,
        uploadedSpecUrls.map((s) => s.fileName)
    );

    const favicon = await resolveAssetToBase64(
        formData.faviconFile,
        formData.faviconUrl,
        formData.faviconFileName,
        "favicon.png"
    );

    const logo = await resolveAssetToBase64(formData.logoFile, formData.logoUrl, formData.logoFileName, "logo.png");

    // Call customize API with base64 data for logo/favicon
    const customizeRequestBody: Record<string, unknown> = {
        orgName,
        docsSiteName: formData.docsSiteName,
        docsSiteUrl: formData.docsSiteUrl,
        primaryColorHex: formData.primaryColorHex,
        openApiSpecUrls: uploadedSpecUrls,
        isFromPostman: !!formData.postmanCollectionId
    };

    // Add logo (prefer base64, fall back to URL)
    if (logo) {
        customizeRequestBody.logoData = logo.data;
        customizeRequestBody.logoFileName = logo.fileName;
    } else if (formData.logoUrl && !formData.logoUrl.startsWith("blob:")) {
        customizeRequestBody.logoUrl = formData.logoUrl;
        customizeRequestBody.logoFileName = formData.logoFileName;
    }

    // Add favicon (prefer base64, fall back to URL)
    if (favicon) {
        customizeRequestBody.faviconData = favicon.data;
        customizeRequestBody.faviconFileName = favicon.fileName;
    } else if (formData.faviconUrl && !formData.faviconUrl.startsWith("blob:")) {
        customizeRequestBody.faviconUrl = formData.faviconUrl;
        customizeRequestBody.faviconFileName = formData.faviconFileName;
    }

    const response = await fetch(`/api/onboarding-docs/customize/${repoData.repoName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customizeRequestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to customize documentation");
    }

    return await response.json();
}

/**
 * Fetches the current workflow status from the API.
 */
export async function fetchWorkflowStatus(owner: string, repoName: string, commitSha?: string): Promise<Response> {
    return fetch("/api/onboarding-docs/workflow-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            owner,
            repoName,
            commitSha
        })
    });
}

/**
 * Triggers a retry of the failed publishing workflow.
 */
export async function retryPublishingWorkflow(owner: string, repoName: string, orgName: string): Promise<void> {
    const response = await fetch("/api/onboarding-docs/retry-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repoName, orgName })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to retry workflow");
    }
}
