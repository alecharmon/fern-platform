"use client";

import { useQuery } from "@tanstack/react-query";

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
                return content;
            }
        })
    );
}
