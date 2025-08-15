"use server";

import { bundleMDX as internalBundleMDX } from "mdx-bundler";

import { OriginalElement, OriginalElements } from "@fern-docs/mdx";

import { WithCode } from "@/providers/OriginalElementsContext";

export async function bundleMDX(source: string) {
  const { code } = await internalBundleMDX({
    source,
  });

  return { code };
}

type OriginalElementWithCode = OriginalElement & {
  code?: string;
  bundleAttempted?: boolean;
};

export async function bundleOriginalElements(
  originalElements: WithCode<OriginalElements>
) {
  // Bundle elements that don't have code OR have undefined code
  const needsBundling = Object.values(originalElements).some(
    (element) => !element.code || !element.bundleAttempted
  );

  if (!needsBundling) {
    return originalElements;
  }

  const bundledEntries = await Promise.all(
    Object.entries(originalElements).map(async ([key, element]) => {
      // If element already has valid code, preserve its existing bundleAttempted status
      if (element.code && element.code !== undefined) {
        return [key, element] as [string, OriginalElementWithCode];
      }

      // Bundle elements that need it (no code or undefined code) and mark as attempted
      try {
        const { code } = await bundleMDX(element.content);
        return [key, { ...element, code, bundleAttempted: true }] as [
          string,
          OriginalElementWithCode,
        ];
      } catch (error) {
        console.warn("Failed to bundle element:", error);
        // Even if bundling fails, mark as attempted so we don't get infinite skeleton
        return [key, { ...element, bundleAttempted: true }] as [
          string,
          OriginalElementWithCode,
        ];
      }
    })
  );
  return Object.fromEntries(bundledEntries);
}
