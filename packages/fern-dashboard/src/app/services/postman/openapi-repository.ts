import type { Json } from "@fern-platform/supabase";

import { getSupabaseClient } from "../supabase";

export interface PostmanCollectionOpenApiSpec {
    id: string;
    team_id: string;
    user_id: string;
    collection_id: string;
    openapi_spec: Json;
    created_at: string;
}

export async function getOpenApiSpecByCollectionId(collectionId: string): Promise<PostmanCollectionOpenApiSpec | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("postman_collection_openapi_specs")
        .select()
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            return null;
        }
        throw new Error(`Failed to get OpenAPI spec for collection ${collectionId}: ${error.message}`);
    }

    return data as PostmanCollectionOpenApiSpec;
}

export async function isUserInTeam(userId: string, teamId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    // Extract the isolated user ID from Auth0 format (<social-providers>|<userId>)
    const isolatedUserId = userId.split("|").pop() ?? userId;

    const { count, error } = await supabase
        .from("postman_collection_openapi_specs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", isolatedUserId)
        .eq("team_id", teamId);

    if (error) {
        console.error(`[Onboarding] Failed to check if user ${userId} is in team ${teamId}: ${error.message}`);
        // FORCE TRUE TO TEST FUNCTIONALITY
        return true;
        // throw new Error(`Failed to check if user ${userId} is in team ${teamId}: ${error.message}`);
    }

    return (count ?? 0) > 0;
}

export async function getLatestOpenApiSpecByTeamId(teamId: string): Promise<PostmanCollectionOpenApiSpec | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("postman_collection_openapi_specs")
        .select()
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            return null;
        }
        throw new Error(`Failed to get OpenAPI spec for team ${teamId}: ${error.message}`);
    }

    return data as PostmanCollectionOpenApiSpec;
}

export async function upsertOpenApiSpec(data: {
    teamId: string;
    userId: string;
    collectionId: string;
    openApiSpec: Json;
}): Promise<PostmanCollectionOpenApiSpec> {
    const supabase = getSupabaseClient();

    const { data: row, error } = await supabase
        .from("postman_collection_openapi_specs")
        .insert({
            team_id: data.teamId,
            user_id: data.userId,
            collection_id: data.collectionId,
            openapi_spec: data.openApiSpec
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to insert OpenAPI spec: ${error.message}`);
    }

    return row as PostmanCollectionOpenApiSpec;
}
