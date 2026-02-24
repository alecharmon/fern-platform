import { z } from "zod";

import { getEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

const WorkosAuthSchema = z.object({
    type: z.literal("workos"),
    org: z.string()
});

const PreviewUrlAuthSchema = z.discriminatedUnion("type", [
    WorkosAuthSchema
    // Add more auth types here as needed
]);

export type PreviewUrlAuth = z.infer<typeof PreviewUrlAuthSchema>;

const PreviewUrlAuthConfigSchema = z.record(PreviewUrlAuthSchema);

type PreviewUrlAuthConfig = z.infer<typeof PreviewUrlAuthConfigSchema>;

export interface Metadata {
    isPreview: boolean;
    org: string;
}

export async function getPreviewUrlAuthConfig(metadata: Metadata): Promise<PreviewUrlAuth | undefined> {
    if (!metadata.isPreview || isLocal() || isSelfHosted()) {
        return undefined;
    }
    const config = await getEdge<PreviewUrlAuthConfig>("authed-previews");
    return config?.[metadata.org];
}
