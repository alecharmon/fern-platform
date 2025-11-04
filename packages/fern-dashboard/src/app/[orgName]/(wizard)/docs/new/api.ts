/**
 * Uploads a file to S3 via the onboarding assets API
 *
 * @param file - The file to upload
 * @param organizationId - The organization ID
 * @returns Object containing the asset URL on success
 */
export async function uploadOnboardingAsset(file: File, organizationId: string): Promise<{ assetUrl: string }> {
    // Step 1: Get the pre-signed upload URL
    const response = await fetch("/api/onboarding-assets/generate-upload-url", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            organizationId,
            contentType: file.type || "application/octet-stream",
            fileName: file.name
        })
    });

    if (!response.ok) {
        throw new Error("Failed to get upload URL");
    }

    const { uploadUrl, assetUrl } = await response.json();

    // Step 2: Upload the file to S3 using the pre-signed URL
    const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type || "application/octet-stream"
        },
        body: file
    });

    if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
    }

    return { assetUrl };
}
