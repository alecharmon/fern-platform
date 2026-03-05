"use client";

import { useQuery } from "@tanstack/react-query";

import { sanitizeSvgString } from "@/app/services/svg-sanitizer";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey } from "./queryKeys";

export function useOrgSvgLogo(svgUrl: string) {
    return convertQueryResultToLoadable(
        useQuery({
            queryKey: ReactQueryKey.orgSvgLogo(svgUrl),
            queryFn: async () => {
                const response = await fetch(svgUrl);
                const content = await response.text();
                if (!response.ok) {
                    console.error("Failed to load logo", content);
                    throw new Error("Failed to load logo");
                }
                // Sanitize SVG content before rendering to prevent XSS attacks
                // This is a defense-in-depth measure alongside server-side sanitization
                return sanitizeSvgString(content);
            }
        })
    );
}
