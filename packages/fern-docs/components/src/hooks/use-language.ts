"use client";

import { usePathname } from "next/navigation";

/**
 * Hook to get the current language from the URL pathname on the client side.
 * The language is expected to be in the format: /[host]/[domain]/[lang]/...
 *
 * @returns The language code (e.g., "en", "es", "fr") or "en" as default
 */
export function useLanguage(): string {
    const pathname = usePathname();

    // pathname format on client: /actual/path/here
    // On the client side in Next.js 15, we don't have access to the internal routing structure
    // so this is just the user-facing path. The middleware handles routing internally.
    // For now, we'll return the default language since the actual lang is in the internal route structure
    // which is not accessible client-side.

    // TODO: When you add language detection from the pathname, implement it here
    // For example: if the path starts with /es/, extract "es"

    return "en";
}

/**
 * Server-side utility to extract language from params.
 * Use this in Server Components where you have access to params.
 *
 * @example
 * ```ts
 * async function MyPage({ params }: { params: Promise<BaseParams> }) {
 *   const { lang } = await params;
 *   // use lang
 * }
 * ```
 */
export function getLanguageFromParams(params: { lang: string }): string {
    return params.lang;
}
