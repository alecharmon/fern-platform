"use client";

import { useTheme } from "next-themes";
import Image, { StaticImageData } from "next/image";

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
}: {
  light: string | StaticImageData;
  dark: string | StaticImageData;
  alt: string;
  className?: string;
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
        aria-hidden={resolvedTheme !== "light"}
        className={`${className ?? ""} transition-opacity duration-300 ${
          resolvedTheme === "light" ? "opacity-100" : "opacity-0"
        }`}
      />
      <Image
        src={dark}
        alt={alt}
        priority
        aria-hidden={resolvedTheme !== "dark"}
        className={`${className ?? ""} transition-opacity duration-300 ${
          resolvedTheme === "dark" ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

export function LoginImage() {
  // render `null` on the first render to match the SSR and avoid hydration errors
  const isFirstClientSideRender = useIsFirstClientSideRender();
  if (isFirstClientSideRender) {
    return null;
  }

  return (
    <div className="animate-float-container transform-3d group absolute bottom-24 left-0 right-16 top-6 m-16 flex w-full">
      <CrossfadeThemeImage
        light={sdkPreviewLight}
        dark={sdkPreviewDark}
        alt="preview of fern docs"
        className="animate-float-sdks z-2 object-fit rotate-x-26 rotate-y-14 rotate-z-3 rotate-345 backface-hidden absolute left-0 w-auto min-w-0 origin-top-left translate-x-60 translate-y-10 scale-[1.1] transform-gpu object-contain transition-transform duration-500 ease-out will-change-transform"
      />
      <CrossfadeThemeImage
        light={loginPreviewLight}
        dark={loginPreviewDark}
        alt="preview of fern docs"
        className="animate-float-docs z-1 object-fit rotate-x-26 rotate-y-14 rotate-z-3 rotate-345 backface-hidden absolute left-0 w-auto min-w-[800px] origin-top-left translate-y-40 transform-gpu object-contain transition-transform duration-500 ease-out will-change-transform"
      />
    </div>
  );
}
