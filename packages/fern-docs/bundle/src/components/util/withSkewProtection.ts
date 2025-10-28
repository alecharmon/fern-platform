import { MDX_PIPELINE_VERSION } from "@fern-api/docs-server/mdx-pipeline-version";

const renderVersion = MDX_PIPELINE_VERSION || process.env.VERCEL_DEPLOYMENT_ID;

export function withSkewProtection(h?: Record<string, string>): HeadersInit | undefined {
    if (!renderVersion) {
        return h;
    }

    return new Headers({ ...h, "X-Render-Version": renderVersion });
}
