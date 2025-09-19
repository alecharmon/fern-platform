"use server";

import { bundleMDX as internalBundleMDX } from "@/editor/mdx/bundle";

const BATCH_SIZE = 25;

type BundleResult = { ok: true; code: string } | { ok: false; error: string };

export async function bundleEditorMDX(
  sources: string[]
): Promise<BundleResult[]> {
  const results: BundleResult[] = [];

  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch = sources.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (source) => {
        try {
          const result = await internalBundleMDX(source);
          return { ok: true as const, code: result.code };
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}
