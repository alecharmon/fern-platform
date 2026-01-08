import { uploadOnboardingAsset } from "./api";

/**
 * Default fallback image for favicon and logo
 */
export const DEFAULT_IMAGE_FALLBACK =
    "https://cdn.brandfetch.io/idPXovIzxA/w/400/h/400/id6bO_yJUx.png?c=1bxid64Mup7aczewSAYMX&t=1745869970633";

/**
 * Ensures an image URL is uploaded to S3 and returns the asset URL.
 * If the URL is null or doesn't exist, uses the default fallback image.
 *
 * @param url - The image URL to upload (can be external URL or null)
 * @param fileName - The name to give the uploaded file
 * @param organizationId - Organization ID for the upload (required)
 * @returns The S3 asset URL or null if upload fails
 */
export async function ensureUploadedImage(
    url: string | null,
    fileName: string,
    organizationId: string
): Promise<string | null> {
    if (!organizationId) {
        throw new Error("organizationId is required for image upload");
    }

    const sourceUrl = url ?? DEFAULT_IMAGE_FALLBACK;
    if (!sourceUrl) {
        return url;
    }

    try {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
            console.error("[ensureUploadedImage] Failed to fetch image:", {
                status: response.status,
                statusText: response.statusText,
                url: sourceUrl
            });
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type || "image/png" });
        const { assetUrl } = await uploadOnboardingAsset(file, organizationId);
        return assetUrl;
    } catch (error) {
        console.error(`[ensureUploadedImage] Error uploading image ${fileName}:`, error);
        throw error;
    }
}

/**
 * Generates a unique session ID for streaming operations
 *
 * @returns A unique session ID string
 */
export function generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generates an organization ID from a docs site URL by extracting the subdomain
 * and sanitizing it to be URL-safe
 *
 * @param docsSiteUrl - The docs site URL (e.g., "my-docs" or "my-docs.docs.buildwithfern.com")
 * @returns A URL-safe organization ID
 */
export function generateOrgIdFromDocsUrl(docsSiteUrl: string): string {
    // Extract subdomain if full URL is provided
    const subdomain = docsSiteUrl
        .replace(/\.docs\.buildwithfern\.com.*$/, "") // Remove domain suffix if present
        .replace(/^https?:\/\//, "") // Remove protocol if present
        .toLowerCase()
        .trim();

    // Sanitize the subdomain
    return subdomain
        .replace(/[^a-z0-9-]/g, "") // Remove special characters
        .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}
