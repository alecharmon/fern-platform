import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import React from "react";

import { Announcement } from "@/components/header/Announcement";
import { MdxServerComponent } from "@/mdx/components/server-component";
import { createCachedMdxSerializer } from "@/server/mdx-serializer";
import {
    createBatchingRemoteMdxSerializer,
    useRemoteMDXRendering,
    withShadowRemoteSerializer
} from "@/server/remote-renderer";

export const revalidate = false;

export default async function AnnouncementPage({
    params
}: {
    params: Promise<{
        host: string;
        domain: string;
        requiresLogin: string;
        isLoggedIn: string;
        roles: string;
        slug: string;
    }>;
}) {
    const { host, domain, slug, ...authParams } = await params;
    const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);
    const loader = await createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin });

    const [config, root, edgeFlags] = await Promise.all([loader.getConfig(), loader.getRoot(), loader.getEdgeFlags()]);

    const { enabled: useRemoteRendering, url: remoteRendererUrl, batchSerializePath, shadow } = useRemoteMDXRendering();

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

    let serialize;
    if (useRemoteRendering && remoteRendererUrl) {
        serialize = createBatchingRemoteMdxSerializer(remoteRendererUrl, loader, {
            useNextMdx: edgeFlags.isNextMdxRef ?? false,
            batchSerializePath
        });
    } else {
        const local = createCachedMdxSerializer(loader, {
            useNextMdx: edgeFlags.isNextMdxRef
        });

        // Shadow mode: fire-and-forget to remote renderer for bug detection
        serialize =
            shadow && remoteRendererUrl
                ? withShadowRemoteSerializer(local, remoteRendererUrl, loader, {
                      useNextMdx: edgeFlags.isNextMdxRef ?? false,
                      batchSerializePath
                  })
                : local;
    }

    return (
        <Announcement announcement={announcementText}>
            <React.Suspense fallback={announcementText}>
                <MdxServerComponent serialize={serialize} mdx={announcementText} />
            </React.Suspense>
        </Announcement>
    );
}
