"use client";

import Image from "next/image";
import { useId, useMemo } from "react";
import useSWRImmutable from "swr/immutable";

interface FernSvgIconProps {
    src: string;
    alt?: string;
    className?: string;
}

export const FernSvgIcon: React.FC<FernSvgIconProps> = ({ src, alt, className }) => {
    const reactId = useId();

    const { data: svgContent, error } = useSWRImmutable(src, () =>
        fetch(src, { cache: "force-cache" }).then((res) => {
            if (!res.ok) {
                throw new Error(`Failed to fetch SVG: ${res.statusText}`);
            }
            return res.text();
        })
    );

    const modifiedSvgContent = useMemo(() => {
        if (!svgContent) {
            return null;
        }

        const safePrefix = reactId.replace(/:/g, "");

        // Prefix all SVG IDs and their references to prevent collisions
        // when multiple SVGs with identical IDs are inlined on the same page.
        let processed = svgContent;
        processed = processed.replaceAll(/\bid="([^"]+)"/g, `id="${safePrefix}-$1"`);
        processed = processed.replaceAll(/url\(#([^)]+)\)/g, `url(#${safePrefix}-$1)`);
        processed = processed.replaceAll(/href="#([^"]+)"/g, `href="#${safePrefix}-$1"`);

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(processed, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");

        if (svgElement) {
            if (className) {
                const existingClass = svgElement.getAttribute("class");
                svgElement.setAttribute("class", existingClass ? `${existingClass} ${className}` : className);
            }

            // size of svg should be set by parent element
            svgElement.setAttribute("width", "100%");
            svgElement.setAttribute("height", "100%");
        }

        return svgElement ? new XMLSerializer().serializeToString(svgElement) : processed;
    }, [svgContent, className, reactId]);

    if (error) {
        return <Image src={src} width={16} height={16} alt={alt ?? ""} className={className} />;
    }

    if (!modifiedSvgContent) {
        return <span className={className} />;
    }

    return <span className={className} dangerouslySetInnerHTML={{ __html: modifiedSvgContent }} />;
};
