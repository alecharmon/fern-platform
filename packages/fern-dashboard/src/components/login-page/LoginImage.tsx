"use client";

import Image, { type StaticImageData } from "next/image";
import { useTheme } from "next-themes";
import type { CSSProperties } from "react";

import { useIsFirstClientSideRender } from "@/utils/useIsFirstClientSideRender";

import loginPreviewDark from "../../../public/login-page-docs-dark.avif";
import loginPreviewLight from "../../../public/login-page-docs-light.avif";
import sdkPreviewDark from "../../../public/login-page-sdks-dark.avif";
import sdkPreviewLight from "../../../public/login-page-sdks-light.avif";

function CrossfadeThemeImage({
    light,
    dark,
    alt,
    className,
    style
}: {
    light: string | StaticImageData;
    dark: string | StaticImageData;
    alt: string;
    className?: string;
    style?: CSSProperties;
}) {
    const { resolvedTheme = "light" } = useTheme();
    const isFirstClientSideRender = useIsFirstClientSideRender();
    if (isFirstClientSideRender) {
        return null;
    }

    return (
        <>
            <Image
                src={light}
                alt={alt}
                priority
                unoptimized
                style={style}
                aria-hidden={resolvedTheme !== "light"}
                className={`${className ?? ""} transition-opacity duration-300 ${
                    resolvedTheme === "light" ? "opacity-100" : "opacity-0"
                }`}
            />
            <Image
                src={dark}
                alt={alt}
                priority
                unoptimized
                style={style}
                aria-hidden={resolvedTheme !== "dark"}
                className={`${className ?? ""} transition-opacity duration-300 ${
                    resolvedTheme === "dark" ? "opacity-100" : "opacity-0"
                }`}
            />
        </>
    );
}

const SHARED_3D_STYLE: CSSProperties = {
    transformStyle: "preserve-3d",
    backfaceVisibility: "hidden",
    rotate: "345deg"
};

const SDK_PREVIEW_STYLE: CSSProperties = {
    ...SHARED_3D_STYLE,
    transform: "rotateX(26deg) rotateY(14deg) rotateZ(3deg) translateX(15rem) translateY(2.5rem) scale(1.1)"
};

const DOCS_PREVIEW_STYLE: CSSProperties = {
    ...SHARED_3D_STYLE,
    transform: "rotateX(26deg) rotateY(14deg) rotateZ(3deg) translateY(10rem)"
};

export function LoginImage() {
    const isFirstClientSideRender = useIsFirstClientSideRender();
    if (isFirstClientSideRender) {
        return null;
    }

    return (
        <div
            className="animate-float-container group absolute bottom-24 left-0 right-16 top-6 m-16 flex w-full"
            style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
        >
            <CrossfadeThemeImage
                light={sdkPreviewLight}
                dark={sdkPreviewDark}
                alt="preview of fern SDKs"
                style={SDK_PREVIEW_STYLE}
                className="animate-float-sdks z-2 absolute left-0 w-auto min-w-[600px] origin-top-left object-contain transition-transform duration-500 ease-out will-change-transform"
            />
            <CrossfadeThemeImage
                light={loginPreviewLight}
                dark={loginPreviewDark}
                alt="preview of fern docs"
                style={DOCS_PREVIEW_STYLE}
                className="animate-float-docs z-1 absolute left-0 w-auto min-w-[800px] origin-top-left object-contain transition-transform duration-500 ease-out will-change-transform"
            />
        </div>
    );
}
