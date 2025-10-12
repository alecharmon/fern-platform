"use client";

import Image, { type StaticImageData } from "next/image";
import { useTheme } from "next-themes";

import { useIsFirstClientSideRender } from "@/utils/useIsFirstClientSideRender";

import exampleDocsSiteDark from "../../../public/example-docs-dark.avif";
import exampleDocsSiteLight from "../../../public/example-docs-light.avif";

function CrossfadeThemeImage({
    light,
    dark,
    alt,
    width,
    height,
    className
}: {
    light: string | StaticImageData;
    dark: string | StaticImageData;
    alt: string;
    width: number;
    height: number;
    className?: string;
}) {
    const { resolvedTheme = "light" } = useTheme();
    const isFirstClientSideRender = useIsFirstClientSideRender();
    if (isFirstClientSideRender) {
        return null;
    }

    return (
        <div className={`relative w-full ${className ?? ""}`} style={{ aspectRatio: width / height }}>
            <Image
                src={light}
                alt={alt}
                fill
                placeholder="blur"
                priority
                aria-hidden={resolvedTheme !== "light"}
                className={`absolute left-0 top-0 h-full w-full object-contain transition-opacity duration-300 ${
                    resolvedTheme === "light" ? "opacity-100" : "opacity-0"
                }`}
            />
            <Image
                src={dark}
                alt={alt}
                fill
                placeholder="blur"
                priority
                aria-hidden={resolvedTheme !== "dark"}
                className={`absolute left-0 top-0 h-full w-full object-contain transition-opacity duration-300 ${
                    resolvedTheme === "dark" ? "opacity-100" : "opacity-0"
                }`}
            />
        </div>
    );
}

export function DocsZeroStateImage() {
    const imgLight = exampleDocsSiteLight as unknown as {
        width: number;
        height: number;
    };
    const intrinsicWidth = imgLight.width;
    const intrinsicHeight = imgLight.height;

    return (
        <CrossfadeThemeImage
            light={exampleDocsSiteLight}
            dark={exampleDocsSiteDark}
            alt="example doc site"
            width={intrinsicWidth}
            height={intrinsicHeight}
        />
    );
}
