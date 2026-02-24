import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { getFdrClient } from "@/app/services/fdr/getFdrClient";
import type { DocsUrl } from "@/utils/types";

type DocsUrlMetadataResult =
    | {
          ok: true;
          body: {
              url: string;
              isPreviewUrl: boolean;
              org: string;
              gitUrl?: string | null;
              enableAlgoliaOnPreview?: boolean | null;
          };
      }
    | {
          ok: false;
          error: { error: string; content?: unknown };
      };

export async function getDocsUrlMetadata({
    url,
    token
}: {
    url: DocsUrl;
    token: string;
}): Promise<DocsUrlMetadataResult> {
    try {
        const result = await getFdrClient({
            token
        }).docs.v2.read.getDocsUrlMetadata({
            url: FdrAPI.Url(url)
        });
        return { ok: true, body: result };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        // Check if the error message indicates a domain not registered error
        if (error.includes("DomainNotRegistered") || error.includes("404")) {
            return { ok: false, error: { error: "DomainNotRegisteredError" } };
        }
        return { ok: false, error: { error, content: e } };
    }
}

export async function getDocsUrlOwner({
    url,
    token
}: {
    url: DocsUrl;
    token: string;
}): Promise<{ orgName: Auth0OrgName }> {
    const metadata = await getDocsUrlMetadata({ url, token });

    if (!metadata.ok) {
        console.error("Failed to load docs URL metadata", JSON.stringify(metadata.error));
        throw new Error("Failed to load docs URL metadata");
    }

    return {
        orgName: Auth0OrgName(metadata.body.org)
    };
}
