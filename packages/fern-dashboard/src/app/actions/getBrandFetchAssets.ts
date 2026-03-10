"use server";

import { getCurrentSession } from "../services/auth0/getCurrentSession";
import type { AutoPopulateUpdates, BrandProfile } from "../services/auto-populate-brand";
import { getBrandFetchAssets as getBrandFetchAssetsService } from "../services/auto-populate-brand";
import type { GetBrandFetchAssetsResult } from "../services/auto-populate-brand/brand-fetch-api";
import { OnboardS3Service } from "../services/onboarding-assets";

const nameToUrl = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
};

function getIconItem(logos: BrandProfile["logos"]) {
    const icon = logos
        ?.find((logo) => logo.type === "icon")
        ?.formats.find((iconFormat) => iconFormat?.format !== "svg");
    if (icon) {
        return icon;
    }
    const logoItem = logos?.find((logo) => logo.type === "logo")?.formats.find((format) => format.format !== "svg");
    if (logoItem) {
        return logoItem;
    }
    const remainingItem = logos
        ?.find((logo) => logo.formats.find((format) => format.format !== "svg"))
        ?.formats.find((format) => format.format !== "svg");
    if (remainingItem) {
        return remainingItem;
    }
    return null;
}

function sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadImageToOnboardingAssets({
    imageUrl,
    organizationId,
    fileName,
    contentType
}: {
    imageUrl: string;
    organizationId: string;
    fileName: string;
    contentType: string;
}): Promise<string | null> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        console.error("Failed to download image:", response.statusText);
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const uploadContentType = contentType || response.headers.get("content-type") || "application/octet-stream";

    const { uploadUrl, assetUrl } = await OnboardS3Service.generateUploadUrl({
        organizationId,
        contentType: uploadContentType,
        fileName: sanitizeFileName(fileName)
    });

    const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": uploadContentType
        },
        body: buffer
    });

    if (!uploadResponse.ok) {
        console.error("Failed to upload image to onboarding assets:", uploadResponse.statusText);
        return null;
    }

    return assetUrl;
}

export const getBrandFetchAssets = async (identifier: string): Promise<GetBrandFetchAssetsResult> => {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: "Not authenticated" };
    }
    return getBrandFetchAssetsService(identifier);
};

export const getBrandAssetsWithUpload = async ({
    identifier,
    organizationId
}: {
    identifier: string;
    organizationId?: string;
}): Promise<{ success: true; updates: AutoPopulateUpdates } | { success: false; error: string }> => {
    const brandResult = await getBrandFetchAssetsService(identifier);
    if (!brandResult.success) {
        return brandResult;
    }

    const brandData = brandResult.data;
    const updates: AutoPopulateUpdates = {};

    if (brandData.name) {
        updates.docsSiteName = brandData.name;
        updates.docsSiteUrl = nameToUrl(brandData.name);
        updates.docsSiteUrlAvailable = null;
    }

    const iconItem = getIconItem(brandData.logos);
    if (iconItem?.src) {
        // If organizationId is provided, upload to S3
        // Otherwise, just use the BrandFetch URL directly
        if (organizationId) {
            try {
                const uploadedUrl = await uploadImageToOnboardingAssets({
                    imageUrl: iconItem.src,
                    organizationId,
                    fileName: `logo.${iconItem.format || "png"}`,
                    contentType: iconItem.format ? `image/${iconItem.format}` : "application/octet-stream"
                });

                if (uploadedUrl) {
                    updates.logoUrl = uploadedUrl;
                    updates.faviconUrl = updates.faviconUrl ?? uploadedUrl;
                }
            } catch (error) {
                console.error("Failed to process logo upload for brand fetch:", error);
            }
        } else {
            // No org ID - use BrandFetch URL directly, will be uploaded during submission
            updates.logoUrl = iconItem.src;
            updates.faviconUrl = updates.faviconUrl ?? iconItem.src;
        }
    }

    if (brandData.colors && brandData.colors.length > 0) {
        let colorToUse =
            brandData.colors.find((color) => color.type === "accent") ||
            brandData.colors.find((color) => color.type === "brand");
        colorToUse = colorToUse || brandData.colors[0];
        if (colorToUse) {
            updates.primaryColorHex = colorToUse.hex;
        }
    }

    return { success: true, updates };
};
