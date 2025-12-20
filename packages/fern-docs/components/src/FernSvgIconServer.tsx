/// <reference types="next" />

import Image from "next/image";

interface FernSvgIconServerProps {
    src: string;
    alt?: string;
    className?: string;
}

async function FernSvgIconServerInternal({ src, alt, className }: FernSvgIconServerProps) {
    try {
        const res = await fetch(src, {
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

        return <span className={className} dangerouslySetInnerHTML={{ __html: modifiedSvgContent }} />;
    } catch (error) {
        console.error(`[FernSvgIconServer] Failed to fetch SVG: ${src}`, error);
        // Fallback to Next.js Image on error
        return <Image src={src} width={16} height={16} alt={alt ?? ""} className={className} />;
    }
}

export async function FernSvgIconServer(props: FernSvgIconServerProps) {
    return <FernSvgIconServerInternal {...props} />;
}
