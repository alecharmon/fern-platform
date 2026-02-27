"use client";

import dynamic from "next/dynamic";

/**
 * Lazily loads UpsellModal on the client only (ssr: false).
 *
 * UpsellModal has a complex hook chain (useCurrentOrganization, useCurrentTier,
 * useEntitlement, etc.) that can trigger "Rendered more hooks than during the
 * previous render" errors when the server-rendered layout hydrates and then
 * immediately handles a redirect (e.g. /fern/docs -> /fern/docs/<site>).
 *
 * By deferring its mount to the client we avoid hook-count mismatches between
 * server and client renders. The modal is hidden by default (no active upsell
 * feature), so there is no visual impact.
 */
const UpsellModalDynamic = dynamic(() => import("./UpsellModal").then((mod) => ({ default: mod.UpsellModal })), {
    ssr: false
});

export function LazyUpsellModal() {
    return <UpsellModalDynamic />;
}
