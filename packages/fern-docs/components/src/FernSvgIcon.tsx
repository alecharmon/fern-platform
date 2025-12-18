"use client";

import Image from "next/image";
import { useMemo } from "react";
import useSWRImmutable from "swr/immutable";

interface FernSvgIconProps {
    src: string;
    alt?: string;
    className?: string;
}

export const FernSvgIcon: React.FC<FernSvgIconProps> = ({ src, alt, className }) => {
    const { data: svgContent, error } = useSWRImmutable(src, () =>
        fetch(src, { cache: "force-cache" }).then((res) => {
            if (!res.ok) {
                throw new Error(`Failed to fetch SVG: ${res.statusText}`);
            }
            return res.text();
        })
    );

    // Memoize the DOM parsing/serialization to avoid repeated work on re-renders
    const modifiedSvgContent = useMemo(() => {
        if (!svgContent) {
            return null;
        }

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");

        if (svgElement && className) {
            const existingClass = svgElement.getAttribute("class");
            svgElement.setAttribute("class", existingClass ? `${existingClass} ${className}` : className);
        }

        return svgElement ? new XMLSerializer().serializeToString(svgElement) : svgContent;
    }, [svgContent, className]);

    if (error) {
        return <Image src={src} width={16} height={16} alt={alt ?? ""} className={className} />;
    }

    if (!modifiedSvgContent) {
        return <span className={className} />;
    }

    return <span dangerouslySetInnerHTML={{ __html: modifiedSvgContent }} />;
};
