import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import React from "react";
import { Announcement } from "@/components/header/Announcement";
import { MdxServerComponent } from "@/mdx/components/server-component";
import { createCachedMdxSerializer } from "@/server/mdx-serializer";
import { getModeConfig } from "@/server/mode-config";
import {
    createBatchingRemoteMdxSerializer,
    getRemoteMDXRenderingConfig,
    setEdgeConfigOverride,
    setRenderingModeOverride,
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
        mode: string;
        slug: string;
    }>;
}) {
    const { host, domain, mode, slug, ...authParams } = await params;
    const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);
    const loader = await createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin });

    const [config, root, edgeFlags] = await Promise.all([loader.getConfig(), loader.getRoot(), loader.getEdgeFlags()]);

    // Set edge config override for the entire request scope.
    // All downstream calls to getRemoteMDXRenderingConfig() will pick this up automatically.
    setEdgeConfigOverride(edgeFlags.isRemoteMdxRenderer);

    // Apply mode-specific rendering overrides (e.g., remote-mdx forces production-remote)
    const modeConfig = getModeConfig(mode);
    if (modeConfig.renderingMode) {
        setRenderingModeOverride(modeConfig.renderingMode);
    }

    const {
        enabled: useRemoteRendering,
        url: remoteRendererUrl,
        batchSerializePath,
        shadow
    } = getRemoteMDXRenderingConfig();

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
