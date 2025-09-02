"use client";

import { useTheme } from "next-themes";
import Image from "next/image";

import { useIsFirstClientSideRender } from "@/utils/useIsFirstClientSideRender";

import veDark from "../../../public/ve-empty-dark.avif";
import veLight from "../../../public/ve_empty.avif";

export function VEPreviewImage({ className }: { className?: string }) {
  const { resolvedTheme = "light" } = useTheme();
  const isFirstClientSideRender = useIsFirstClientSideRender();
  if (isFirstClientSideRender) {
    return null;
  }

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <Image
        src={veLight}
        alt="Visual Editor Preview"
        fill
        placeholder="blur"
        aria-hidden={resolvedTheme !== "light"}
        className={`absolute left-0 top-0 h-full w-full object-contain object-bottom transition-opacity duration-300 ${
          resolvedTheme === "light" ? "opacity-100" : "opacity-0"
        }`}
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
      <Image
        src={veDark}
        alt="Visual Editor Preview"
        fill
        placeholder="blur"
        aria-hidden={resolvedTheme !== "dark"}
        className={`absolute left-0 top-0 h-full w-full object-contain object-bottom transition-opacity duration-300 ${
          resolvedTheme === "dark" ? "opacity-100" : "opacity-0"
        }`}
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}
