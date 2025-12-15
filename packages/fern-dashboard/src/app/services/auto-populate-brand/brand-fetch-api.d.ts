import type { BrandProfile } from "./index";

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

export type GetBrandFetchAssetsResult = { success: true; data: BrandProfile } | { success: false; error: string };
