"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface FernSvgIconProps {
    src: string;
    alt?: string;
    className?: string;
}

export const FernSvgIcon: React.FC<FernSvgIconProps> = ({ src, alt, className }) => {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        let isMounted = true;

        const fetchSvg = async () => {
            try {
                // fetch icon from s3
                const response = await fetch(src);
                if (!response.ok) {
                    throw new Error(`Failed to fetch SVG: ${response.statusText}`);
                }
                const text = await response.text();
                if (isMounted) {
                    setSvgContent(text);
                }
            } catch (err) {
                console.error("Error fetching SVG:", err);
                if (isMounted) {
                    setError(true);
                }
            }
        };

        void fetchSvg();

        return () => {
            isMounted = false;
        };
    }, [src]);

    if (error) {
        return <Image src={src} width={16} height={16} alt={alt ?? ""} className={className} />;
    }

    if (!svgContent) {
        return <span className={className} />;
    }

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    if (svgElement && className) {
        const existingClass = svgElement.getAttribute("class");
        svgElement.setAttribute("class", existingClass ? `${existingClass} ${className}` : className);
    }

    const modifiedSvgContent = svgElement ? new XMLSerializer().serializeToString(svgElement) : svgContent;

    return <span dangerouslySetInnerHTML={{ __html: modifiedSvgContent }} />;
};
