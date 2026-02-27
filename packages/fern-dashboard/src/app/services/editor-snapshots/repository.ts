import type { Json } from "@fern-platform/supabase";
import { getSupabaseClient } from "../supabase";

export interface EditorSnapshotMetadata {
    branch: string;
    docsUrl: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    prTitle?: string | null;
    prUrl?: string | null;
    orgName?: string | null;
}

export async function getSnapshot(
    orgId: string,
    branch: string,
    docsUrl: string
): Promise<{ snapshotData: Json } | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("editor_navigation_snapshots")
        .select("snapshot_data")
        .eq("org_id", orgId)
        .eq("branch", branch)
        .eq("docs_url", docsUrl)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            return null;
        }
        throw new Error(`Failed to get snapshot: ${error.message}`);
    }

    return { snapshotData: data.snapshot_data };
}

export async function upsertSnapshot(params: {
    userId: string;
    orgId: string;
    branch: string;
    docsUrl: string;
    snapshotData: Json;
    schemaVersion: number;
}): Promise<{ id: string; createdAt: string; updatedAt: string }> {
    const supabase = getSupabaseClient();

    const { data, error } = await (supabase as any)
        .from("editor_navigation_snapshots")
        .upsert(
            {
                user_id: params.userId,
                org_id: params.orgId,
                branch: params.branch,
                docs_url: params.docsUrl,
                snapshot_data: params.snapshotData,
                schema_version: params.schemaVersion
            },
            { onConflict: "org_id,branch,docs_url" }
        )
        .select("id, created_at, updated_at")
        .single();

    if (error) {
        throw new Error(`Failed to upsert snapshot: ${error.message}`);
    }

    return {
        id: data.id as string,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string
    };
}

export async function deleteSnapshot(orgId: string, branch: string, docsUrl: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
        .from("editor_navigation_snapshots")
        .delete()
        .eq("org_id", orgId)
        .eq("branch", branch)
        .eq("docs_url", docsUrl);

    if (error) {
        return false;
    }
    return true;
}

function extractMetadata(snapshotData: Json): {
    prTitle?: string;
    prUrl?: string;
    orgName?: string;
} {
    if (typeof snapshotData !== "object" || snapshotData === null || Array.isArray(snapshotData)) {
        return {};
    }
    const obj = snapshotData as Record<string, Json | undefined>;
    const metadata = obj.metadata;
    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
        return {};
    }
    const meta = metadata as Record<string, Json | undefined>;
    return {
        prTitle: typeof meta.prTitle === "string" ? meta.prTitle : undefined,
        prUrl: typeof meta.prUrl === "string" ? meta.prUrl : undefined,
        orgName: typeof meta.orgName === "string" ? meta.orgName : undefined
    };
}

export async function listSnapshots(orgId: string, docsUrl?: string): Promise<EditorSnapshotMetadata[]> {
    const supabase = getSupabaseClient();

    let query = supabase
        .from("editor_navigation_snapshots")
        .select("branch, docs_url, schema_version, created_at, updated_at, snapshot_data")
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false });

    if (docsUrl != null) {
        query = query.eq("docs_url", docsUrl);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to list snapshots: ${error.message}`);
    }

    return (data ?? []).map((row) => {
        const { prTitle, prUrl, orgName } = extractMetadata(row.snapshot_data);
        return {
            branch: row.branch,
            docsUrl: row.docs_url,
            schemaVersion: row.schema_version,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            prTitle,
            prUrl,
            orgName
        };
    });
}

export async function updateSnapshotMetadata(
    orgId: string,
    branch: string,
    docsUrl: string,
    update: { prTitle?: string | null; prUrl?: string | null }
): Promise<boolean> {
    const existing = await getSnapshot(orgId, branch, docsUrl);
    if (existing == null) {
        return false;
    }

    const snapshotData =
        typeof existing.snapshotData === "object" &&
        existing.snapshotData !== null &&
        !Array.isArray(existing.snapshotData)
            ? (existing.snapshotData as Record<string, Json | undefined>)
            : {};

    const metadata =
        typeof snapshotData.metadata === "object" &&
        snapshotData.metadata !== null &&
        !Array.isArray(snapshotData.metadata)
            ? { ...(snapshotData.metadata as Record<string, Json | undefined>) }
            : {};

    if (update.prTitle !== undefined) {
        if (update.prTitle) {
            metadata.prTitle = update.prTitle;
        } else {
            delete metadata.prTitle;
        }
    }
    if (update.prUrl !== undefined) {
        if (update.prUrl) {
            metadata.prUrl = update.prUrl;
        } else {
            delete metadata.prUrl;
        }
    }

    const supabase = getSupabaseClient();

    const { error } = await (supabase as any)
        .from("editor_navigation_snapshots")
        .update({ snapshot_data: { ...snapshotData, metadata } })
        .eq("org_id", orgId)
        .eq("branch", branch)
        .eq("docs_url", docsUrl);

    if (error) {
        throw new Error(`Failed to update metadata: ${error.message}`);
    }

    return true;
}
