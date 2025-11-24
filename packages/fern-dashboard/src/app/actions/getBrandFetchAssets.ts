"use server";

export interface BrandFetchResponse {
    id: string;
    name: string;
    domain: string;
    claimed: boolean;
    description?: string;
    longDescription?: string;
    links?: {
        name: string;
        url: string;
    }[];
    logos?: {
        theme: "dark" | "light";
        formats: {
            src: string;
            format: "svg" | "png" | "jpg" | "webp";
            height?: number;
            width?: number;
            size?: number;
            background?: "transparent" | string;
        }[];
        tags?: Record<string, unknown>[];
        type: "icon" | "logo" | "symbol" | "mark";
    }[];
    colors?: {
        hex: string;
        type: "accent" | "brand" | "primary" | "secondary" | "background";
        brightness?: number;
    }[];
    fonts?: {
        name: string;
        type: "title" | "body" | "heading";
        origin?: "google" | "adobe" | "system";
        originId?: string;
        weights?: Record<string, unknown>[];
    }[];
    images?: {
        formats: {
            src: string;
            format: "svg" | "png" | "jpg" | "webp";
            height?: number;
            width?: number;
            size?: number;
            background?: "transparent" | string;
        }[];
        tags?: Record<string, unknown>[];
        type: "banner" | "cover" | "screenshot";
    }[];
    qualityScore?: number;
    company?: {
        employees?: number;
        financialIdentifiers?: {
            isin?: string[];
            ticker?: string[];
        };
        foundedYear?: number;
        industries?: {
            id: string;
            score?: number;
            slug: string;
            name: string;
            emoji?: string;
            parent?: {
                id: string;
                slug: string;
                name: string;
                emoji?: string;
            }[];
        }[];
        kind?: "EDUCATIONAL" | "BUSINESS" | "GOVERNMENT" | "NONPROFIT" | "PERSONAL";
        location?: {
            city?: string;
            country?: string;
            countryCode?: string;
            region?: string;
            state?: string;
            subregion?: string;
        };
    };
    isNsfw?: boolean;
    urn?: string;
}

export type GetBrandFetchAssetsResult = { success: true; data: BrandFetchResponse } | { success: false; error: string };

/**
 * Fetches brand assets from BrandFetch API
 *
 * @param identifier - Domain name or brand identifier (e.g., "stripe.com")
 * @returns Brand data including logos, colors, fonts, and other assets
 */
export const getBrandFetchAssets = async (identifier: string): Promise<GetBrandFetchAssetsResult> => {
    if (!identifier || identifier.trim().length === 0) {
        return {
            success: false,
            error: "Identifier is required"
        };
    }

    // eslint-disable-next-line turbo/no-undeclared-env-vars -- BRANDFETCH_API_KEY is declared in turbo.json
    const apiKey = process.env.BRANDFETCH_API_KEY;
    if (!apiKey) {
        console.error("BRANDFETCH_API_KEY is not configured");
        return {
            success: false,
            error: "BrandFetch API key is not configured"
        };
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
                return {
                    success: false,
                    error: "Brand not found"
                };
            }

            const errorText = await response.text().catch(() => "Unknown error");
            console.error(`BrandFetch API error (${response.status}):`, errorText);

            return {
                success: false,
                error: `Failed to fetch brand data: ${response.status} ${response.statusText}`
            };
        }

        const data = (await response.json()) as BrandFetchResponse;

        return {
            success: true,
            data
        };
    } catch (error) {
        console.error("Error fetching BrandFetch data:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred"
        };
    }
};
