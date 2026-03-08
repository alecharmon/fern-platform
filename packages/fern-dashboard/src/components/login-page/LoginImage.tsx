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

// Tailwind v4 3D transform utilities (rotate-x-*, rotate-y-*, rotate-z-*) are not supported
// by Turbopack, so we use equivalent inline CSS properties instead.
//
// The individual CSS properties (translate, rotate, scale) compose with the transform property
// in the order: translate → rotate → scale → transform (per the CSS spec).
//
// Original Tailwind classes for reference:
//   rotate-x-26 rotate-y-14 rotate-z-3 rotate-345 backface-hidden translate-x-60 translate-y-10 scale-[1.1] transform-gpu

// NOTE: The base `transform` (3D rotations) is set in globals.css on the
// .animate-float-sdks / .animate-float-docs classes, NOT here as an inline style.
// This is intentional: inline styles have higher specificity than CSS rules,
// so the hover `transform` override in globals.css wouldn't work if we set
// `transform` as an inline style.
const SHARED_3D_STYLE: CSSProperties = {
    backfaceVisibility: "hidden",
    rotate: "345deg"
};

const SDK_PREVIEW_STYLE: CSSProperties = {
    ...SHARED_3D_STYLE,
    translate: "15rem 2.5rem",
    scale: "0.8"
};

const DOCS_PREVIEW_STYLE: CSSProperties = {
    ...SHARED_3D_STYLE,
    translate: "0px 10rem"
};

export function LoginImage() {
    // render `null` on the first render to match the SSR and avoid hydration errors
    const isFirstClientSideRender = useIsFirstClientSideRender();
    if (isFirstClientSideRender) {
        return null;
    }

    return (
        <div
            className="animate-float-container group absolute bottom-24 left-0 right-16 top-6 m-16 flex w-full"
            style={{ transformStyle: "preserve-3d" }}
        >
            <CrossfadeThemeImage
                light={sdkPreviewLight}
                dark={sdkPreviewDark}
                alt="preview of fern SDKs"
                style={SDK_PREVIEW_STYLE}
                className="animate-float-sdks z-2 absolute left-0 w-auto min-w-0 origin-top-left object-contain transition-transform duration-500 ease-out will-change-transform"
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
