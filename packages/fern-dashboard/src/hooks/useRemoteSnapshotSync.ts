"use client";

import type { RemoteSnapshotSync } from "@fern-docs/components/navigation";
import { useMemo } from "react";

async function fetchApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`/api/editor/snapshots/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`Editor snapshots API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
}

export function useRemoteSnapshotSync(orgName: string): RemoteSnapshotSync {
    return useMemo(
        (): RemoteSnapshotSync => ({
            async loadSnapshot(params: { orgId: string; branch: string; docsUrl: string; localSnapshot?: unknown }) {
                return fetchApi<{ source: "remote" | "local"; snapshot?: unknown }>("get", {
                    orgName,
                    branch: params.branch,
                    docsUrl: params.docsUrl,
                    localSnapshot: params.localSnapshot
                });
            },
            async saveSnapshot(params: {
                orgId: string;
                branch: string;
                docsUrl: string;
                snapshotData: unknown;
                schemaVersion?: number | null;
            }) {
                await fetchApi("save", {
                    orgName,
                    branch: params.branch,
                    docsUrl: params.docsUrl,
                    snapshotData: params.snapshotData,
                    schemaVersion: params.schemaVersion
                });
            },
            async deleteSnapshot(params: { orgId: string; branch: string; docsUrl: string }) {
                await fetchApi("delete", {
                    orgName,
                    branch: params.branch,
                    docsUrl: params.docsUrl
                });
            },
            async listSnapshots(params: { orgId: string; docsUrl?: string }) {
                return fetchApi("list", {
                    orgName,
                    docsUrl: params.docsUrl
                });
            },
            async updateMetadata(params: {
                orgId: string;
                branch: string;
                docsUrl: string;
                prTitle?: string | null;
                prUrl?: string | null;
            }) {
                await fetchApi("metadata", {
                    orgName,
                    branch: params.branch,
                    docsUrl: params.docsUrl,
                    prTitle: params.prTitle,
                    prUrl: params.prUrl
                });
            }
        }),
        [orgName]
    );
}
