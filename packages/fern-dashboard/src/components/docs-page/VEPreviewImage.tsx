"use client";

import Image from "next/image";
import { useTheme } from "next-themes";

import { useIsFirstClientSideRender } from "@/utils/useIsFirstClientSideRender";
import veLight from "../../../public/ve_empty.avif";
import veDark from "../../../public/ve-empty-dark.avif";

export function VEPreviewImage({ className }: { className?: string }) {
    const { resolvedTheme = "light" } = useTheme();
    const isFirstClientSideRender = useIsFirstClientSideRender();
    if (isFirstClientSideRender) {
        return null;
    }

    return (
        <div className={`w-full flex justify-center overflow-hidden -mb-3 md:-mb-5 lg:-mb-6 ${className ?? ""}`}>
            <Image
                src={veLight}
                alt="Fern Editor Preview"
                placeholder="blur"
                aria-hidden={resolvedTheme !== "light"}
                className={`w-full h-auto max-w-[640px] object-contain transition-opacity duration-300 block dark:hidden ${
                    resolvedTheme === "light" ? "opacity-100" : "opacity-0"
                }`}
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1500px"
            />
            <Image
                src={veDark}
                alt="Fern Editor Preview"
                placeholder="blur"
                aria-hidden={resolvedTheme !== "dark"}
                className={`w-full h-auto max-w-[640px] object-contain transition-opacity duration-300 hidden dark:block ${
                    resolvedTheme === "dark" ? "opacity-100" : "opacity-0"
                }`}
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1500px"
            />
        </div>
    );
}
