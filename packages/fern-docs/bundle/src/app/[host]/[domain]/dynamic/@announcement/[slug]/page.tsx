import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import React from "react";

import { getFernToken } from "@/app/fern-token";
import { Announcement } from "@/components/header/Announcement";
import { MdxServerComponent } from "@/mdx/components/server-component";
import { createCachedMdxSerializer } from "@/server/mdx-serializer";

export default async function AnnouncementPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());

    const [config, root, edgeFlags] = await Promise.all([loader.getConfig(), loader.getRoot(), loader.getEdgeFlags()]);

    let announcementText = config.announcement?.text;

    if (root != null) {
        const found = FernNavigation.utils.findNode(root, slugjoin(slug));

        if (found.type === "found") {
            if (found.currentVersion?.announcement?.text) {
                announcementText = found.currentVersion.announcement.text;
            } else if (found.currentProduct?.type === "product" && found.currentProduct.announcement?.text) {
                announcementText = found.currentProduct.announcement.text;
            }
        }
    }

    if (!announcementText) {
        return null;
    }

    const serialize = createCachedMdxSerializer(loader, {
        useNextMdx: edgeFlags.isNextMdxRef
    });

    return (
        <Announcement announcement={announcementText}>
            <React.Suspense fallback={announcementText}>
                <MdxServerComponent serialize={serialize} mdx={announcementText} />
            </React.Suspense>
        </Announcement>
    );
}
