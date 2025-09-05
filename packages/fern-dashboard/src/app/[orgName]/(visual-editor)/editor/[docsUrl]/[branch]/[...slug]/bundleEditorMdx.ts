"use server";

import { bundleMDX as internalBundleMDX } from "mdx-bundler";

export async function bundleMDX(source: string) {
  const { code } = await internalBundleMDX({
    source,
  });

  return { code };
}
