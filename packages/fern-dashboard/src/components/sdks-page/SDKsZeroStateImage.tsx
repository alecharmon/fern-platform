"use client";

import Image, { type StaticImageData } from "next/image";
import { useTheme } from "next-themes";

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
                className={`absolute left-0 top-0 object-contain transition-opacity duration-300 ${
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
                className={`absolute left-0 top-0 object-contain transition-opacity duration-300 ${
                    resolvedTheme === "dark" ? "opacity-100" : "opacity-0"
                }`}
            />
        </div>
    );
}

export function SDKsZeroStateImage() {
    return (
        <div
            style={{
                // Scale down in transform to compensate for the larger container
                transform: `perspective(1200px) rotateX(7deg) rotateY(12deg) rotateZ(-5deg) scale(1)`,
                transformOrigin: "center center",
                transformStyle: "preserve-3d",
                willChange: "transform",
                backfaceVisibility: "hidden",
                maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                width: "100%",
                height: "100%"
            }}
        >
            <CrossfadeThemeImage
                light={exampleSDKsLight}
                dark={exampleSDKsDark}
                alt="example SDKs image"
                width={2000}
                height={250}
            />
        </div>
    );
}
