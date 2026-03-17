/// <reference types="next" />

import Image from "next/image";
import { serverSanitizeIconHtml } from "./util/sanitizeIconHtml";

interface FernSvgIconServerProps {
    src: string;
    alt?: string;
    className?: string;
}

function getFileCDN(): string {
    return (
        (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FILES_ORIGIN : undefined) ??
        "https://files.buildwithfern.com"
    );
}

function getAbsoluteUrl(src: string): string {
    // Strip angle brackets that may wrap URLs (e.g. from oRPC serialization)
    let cleanSrc = src;
    if (cleanSrc.includes("<http")) {
        cleanSrc = cleanSrc.replace(/<(https?:\/\/[^>]+)>/g, "$1");
    }

    // If already absolute, return as-is
    if (cleanSrc.startsWith("http://") || cleanSrc.startsWith("https://")) {
        return cleanSrc;
    }

    // For /_files/ paths, convert back to absolute CDN URL for server-side fetching.
    // These relative paths are created by replacing the CDN origin with "/_files" for
    // client-side asset hosting (middleware rewrites them back), but server-side fetch()
    // doesn't go through middleware and requires absolute URLs.
    if (cleanSrc.includes("/_files/")) {
        const filePath = cleanSrc.replace("https:/", "https://"); // restore protocol if pathname-normalized
        const removeBase = filePath.replace(/(.*)_files\//, ""); // strip everything before and including /_files/
        return `${getFileCDN()}/${removeBase}`;
    }

    // For /_local/ paths in local dev, use NEXT_PUBLIC_FDR_ORIGIN
    // Node.js fetch() requires absolute URLs, but /_local/ paths are relative
    if (cleanSrc.startsWith("/_local/")) {
        const fdrOrigin = process.env.NEXT_PUBLIC_FDR_ORIGIN;
        if (fdrOrigin) {
            return new URL(cleanSrc, fdrOrigin).toString();
        }
    }

    return cleanSrc;
}

async function FernSvgIconServerInternal({ src, alt, className }: FernSvgIconServerProps) {
    const fetchUrl = getAbsoluteUrl(src);

    try {
        const res = await fetch(fetchUrl, {
            cache: "force-cache",
            next: { tags: ["svg-icon", src] }
        });

        if (!res.ok) {
            // Fallback to Next.js Image if fetch fails
            return <Image src={src} width={16} height={16} alt={alt ?? ""} className={className} />;
        }

        const svgContent = await res.text();

        // Add className to the SVG using regex (server-safe approach)
        let modifiedSvgContent = svgContent;
        if (className) {
            // Check if SVG already has a class attribute
            if (svgContent.includes('class="')) {
                // Append to existing class
                modifiedSvgContent = svgContent.replace(/class="([^"]*)"/, `class="$1 ${className}"`);
            } else {
                // Add new class attribute after the opening <svg tag
                modifiedSvgContent = svgContent.replace(/<svg/, `<svg class="${className}"`);
            }
        }

        return (
            <span
                className={className}
                dangerouslySetInnerHTML={{ __html: serverSanitizeIconHtml(modifiedSvgContent) }}
            />
        );
    } catch (error) {
        console.error(`[FernSvgIconServer] Failed to fetch SVG: ${src}`, error);
        // Fallback to Next.js Image on error
        return <Image src={src} width={16} height={16} alt={alt ?? ""} className={className} />;
    }
}

export async function FernSvgIconServer(props: FernSvgIconServerProps) {
    return <FernSvgIconServerInternal {...props} />;
}
