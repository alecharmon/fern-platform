"use client";

import { useTheme } from "next-themes";
import Image, { StaticImageData } from "next/image";

import { useIsFirstClientSideRender } from "@/utils/useIsFirstClientSideRender";

import exampleSDKsDark from "../../../public/example-sdks-dark.avif";
import exampleSDKsLight from "../../../public/example-sdks-light.avif";

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

export function SDKsZeroStateImage() {
    const imgLight = exampleSDKsLight as unknown as {
        width: number;
        height: number;
    };
    const intrinsicWidth = imgLight.width;
    const intrinsicHeight = imgLight.height;

    return (
        <CrossfadeThemeImage
            light={exampleSDKsLight}
            dark={exampleSDKsDark}
            alt="example SDKs image"
            width={intrinsicWidth}
            height={intrinsicHeight}
        />
    );
}
