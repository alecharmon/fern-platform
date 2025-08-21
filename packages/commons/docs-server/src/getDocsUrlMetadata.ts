import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Agent, setGlobalDispatcher } from "undici";

import { withoutStaging } from "@fern-api/docs-utils";

import { cacheSeed } from "./cache-seed";
import { fernToken_admin, getFdrOrigin } from "./env-variables";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

setGlobalDispatcher(
  new Agent({
    connect: { timeout: 2147483647 },
    bodyTimeout: 0,
    headersTimeout: 2147483647,
  })
);

export const uncachedGetDocsUrlMetadata = async (
  domain: string
): Promise<{
  url: string;
  org: string;
  isPreview: boolean;
}> => {
  if (isLocal()) {
    return {
      url: domain,
      org: domain.split(".")[0] ?? domain,
      isPreview: true,
    };
  }

  try {
    const response = await fetch(
      `${getFdrOrigin()}/v2/registry/docs/metadata-for-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: isSelfHosted() ? "" : `Bearer ${fernToken_admin()}`,
        },
        body: JSON.stringify({ url: withoutStaging(domain) }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Invalid docs url metadata for ${withoutStaging(domain)} (response is not ok) ${response.status} ${response.statusText}`
      );
    }

    const body = (await response.json()) as any;
    if (typeof body !== "object" || body == null) {
      throw new Error("Invalid docs url metadata (body is not an object)");
    }
    if (typeof body.url !== "string") {
      throw new Error("Invalid docs url metadata (url is not a string)");
    }
    if (typeof body.org !== "string") {
      throw new Error("Invalid docs url metadata (org is not a string)");
    }
    if (typeof body.isPreviewUrl !== "boolean") {
      throw new Error(
        "Invalid docs url metadata (isPreviewUrl is not a boolean)"
      );
    }
    return {
      url: body.url,
      org: body.org,
      isPreview: body.isPreviewUrl,
    };
  } catch (error) {
    console.error(
      `Failed to get docs url metadata for ${withoutStaging(domain)}`,
      {
        cause: error,
      }
    );
    notFound();
  }
};

export const getDocsUrlMetadata = cache((domain: string) => {
  const get = unstable_cache(
    () => uncachedGetDocsUrlMetadata(domain),
    [domain, cacheSeed()],
    { tags: [domain, "getDocsUrlMetadata"] }
  );
  return get();
});
