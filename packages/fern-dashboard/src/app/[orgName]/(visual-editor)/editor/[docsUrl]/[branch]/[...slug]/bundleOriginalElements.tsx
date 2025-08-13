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
  // Only bundle if elements don't already have code (prevents infinite loop)
  const needsBundling = Object.values(originalElements).some(
    (element) => !element.code
  );

  if (!needsBundling) {
    return originalElements;
  }

  const bundledEntries = await Promise.all(
    Object.entries(originalElements).map(async ([key, element]) => {
      const { code } = await bundleMDX(element.content);
      return [key, { ...element, code, bundleAttempted: true }] as [
        string,
        OriginalElementWithCode,
      ];
    })
  );
  return Object.fromEntries(bundledEntries);
}
