/**
 * Uploads a file to S3 via the onboarding assets API
 *
 * @param file - The file to upload
 * @param organizationId - Organization ID (required for upload URL generation)
 * @returns Object containing the asset URL on success
 */
export async function uploadOnboardingAsset(file: File, organizationId: string): Promise<{ assetUrl: string }> {
    if (!organizationId) {
        throw new Error("organizationId is required for uploading assets");
    }

    // Step 1: Get the pre-signed upload URL
    const requestBody = {
        organizationId,
        contentType: file.type || "application/octet-stream",
        fileName: file.name
    };

    const response = await fetch("/api/onboarding-assets/generate-upload-url", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[uploadOnboardingAsset] Failed to get upload URL:", {
            status: response.status,
            statusText: response.statusText,
            body: errorText
        });
        throw new Error(`Failed to get upload URL: ${response.status} ${response.statusText} - ${errorText}`);
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
        const errorText = await uploadResponse.text();
        console.error("[uploadOnboardingAsset] Failed to upload to S3:", {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            body: errorText
        });
        throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    return { assetUrl };
}
