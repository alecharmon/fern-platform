import { createEditableDocsLoader } from "@fern-api/docs-loader";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import { withLogo } from "@fern-api/docs-server/withLogo";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { AbstractLogo } from "@fern-docs/components/abstract/logo";
import { getFrontmatter } from "@fern-docs/mdx";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function LogoPage({
    params
}: {
    params: Promise<{ docsUrl: EncodedDocsUrl; slug: string; branch: string }>;
}) {
    const session = await getCurrentSession();
    const { docsUrl, slug, branch } = await params;
    const host = await getHostFromHeaders();
    const loader = await createEditableDocsLoader({
        host,
        encodedDocsUrl: docsUrl,
        fernToken: session?.accessToken,
        branchName: branch
    });

    const [{ basePath }, config, files, root] = await Promise.all([
        loader.getMetadata(),
        loader.getConfig(),
        loader.getFiles(),
        loader.getRoot()
    ]);

    const resolveFileSrc = createFileResolver(files);
    const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));

    let frontmatter = null;
    if (foundNode.type === "found") {
        const pageId = getPageId(foundNode.node);
        if (pageId) {
            const page = await loader.getPage(pageId);
            frontmatter = page ? getFrontmatter(page.markdown) : null;
        }
    }

    return <AbstractLogo logo={withLogo(config, resolveFileSrc, basePath, frontmatter?.data)} />;
}
