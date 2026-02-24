import "server-only";

import { z } from "zod";

import { AnthropicClient } from "../anthropic";
import type { BrandFetchResponse, GetBrandFetchAssetsResult } from "./brand-fetch-api";

const BrandFetchFormatSchema = z.object({
    src: z.string().url().describe("URL of the image format"),
    format: z.enum(["png", "jpg", "svg", "ico", "webp", "gif"]),
    background: z.string().optional()
});

const BrandFetchLogoSchema = z.object({
    formats: z.array(BrandFetchFormatSchema).default([]),
    tags: z.array(z.record(z.unknown())).optional(),
    type: z.enum(["icon", "logo", "symbol", "mark"])
});

const BrandFetchColorSchema = z.object({
    hex: z.string().optional(),
    type: z.enum(["accent", "brand", "primary", "secondary", "background"]).optional(),
    brightness: z.number().optional()
});

export const BrandProfileSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    longDescription: z.string().optional(),
    logos: z.array(BrandFetchLogoSchema).optional(),
    colors: z.array(BrandFetchColorSchema).optional()
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export type AutoPopulateUpdates = {
    docsSiteName?: string;
    docsSiteUrl?: string;
    docsSiteUrlAvailable?: boolean | null;
    faviconUrl?: string | null;
    logoUrl?: string | null;
    primaryColorHex?: string | null;
};

const formatIdentifierAsUrl = (identifier: string): string =>
    identifier.startsWith("http://") || identifier.startsWith("https://") ? identifier : `https://${identifier}`;

async function fallbackWithAnthropic(identifier: string, baseError: string): Promise<GetBrandFetchAssetsResult> {
    try {
        console.log("Using Anthropic fallback for brand fetch assets for identifier:", identifier);
        const client = new AnthropicClient();
        const profile = await client.generateBrandProfileFromUrl(formatIdentifierAsUrl(identifier));
        if (!profile) {
            return { success: false, error: baseError };
        }

        return { success: true, data: profile as BrandProfile };
    } catch (error) {
        console.error("Anthropic fallback failed:", error);
        return { success: false, error: baseError };
    }
}

export const getBrandFetchAssets = async (identifier: string): Promise<GetBrandFetchAssetsResult> => {
    if (!identifier || identifier.trim().length === 0) {
        return {
            success: false,
            error: "Identifier is required"
        };
    }

    const apiKey = process.env.BRANDFETCH_API_KEY;
    if (!apiKey) {
        console.error("BRANDFETCH_API_KEY is not configured");
        return fallbackWithAnthropic(identifier, "BrandFetch API key is not configured");
    }

    try {
        const response = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(identifier)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return fallbackWithAnthropic(identifier, "Brand not found");
            }

            const errorText = await response.text().catch(() => "Unknown error");
            console.error(`BrandFetch API error (${response.status}):`, errorText);

            return fallbackWithAnthropic(
                identifier,
                `Failed to fetch brand data: ${response.status} ${response.statusText}`
            );
        }

        const data = (await response.json()) as BrandFetchResponse;

        const brandProfile: BrandProfile = {
            name: data.name,
            description: data.description,
            longDescription: data.longDescription,
            logos: data.logos
                ?.map((logo) => {
                    const formats = logo.formats
                        .filter(
                            (format): format is { src: string; format: "png" | "jpg"; background?: string } =>
                                format.format === "png" || format.format === "jpg"
                        )
                        .map((format) => ({
                            src: format.src,
                            format: format.format,
                            background: format.background
                        }));

                    if (formats.length === 0) {
                        return null;
                    }

                    return {
                        type: logo.type,
                        formats
                    };
                })
                .filter((logo): logo is NonNullable<typeof logo> => logo !== null),
            colors: data.colors?.map((color) => ({
                hex: color.hex,
                type: color.type,
                brightness: color.brightness
            }))
        };

        return {
            success: true,
            data: brandProfile
        };
    } catch (error) {
        console.error("Error fetching BrandFetch data:", error);
        return fallbackWithAnthropic(
            identifier,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};
