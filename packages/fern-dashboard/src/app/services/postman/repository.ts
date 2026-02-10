import { getSupabaseClient } from "../supabase";

export interface PostmanAppInstallation {
    team_id: string;
    shared_secret: string;
    app_installation_id: string;
    created_at: string;
    updated_at: string;
}

export async function upsertAppInstallation(data: {
    teamId: string;
    sharedSecret: string;
    appInstallationId: string;
}): Promise<PostmanAppInstallation> {
    const supabase = getSupabaseClient();

    const { data: row, error } = await supabase
        .from("postman_app_installations")
        .upsert(
            {
                team_id: data.teamId,
                shared_secret: data.sharedSecret,
                app_installation_id: data.appInstallationId
            },
            { onConflict: "team_id" }
        )
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to upsert postman app installation: ${error.message}`);
    }

    return row as PostmanAppInstallation;
}

export async function getAppInstallationByTeamId(teamId: string): Promise<PostmanAppInstallation | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from("postman_app_installations").select().eq("team_id", teamId).single();

    if (error) {
        if (error.code === "PGRST116") {
            return null;
        }
        throw new Error(`Failed to get postman app installation: ${error.message}`);
    }

    return data as PostmanAppInstallation;
}

export async function deleteAppInstallation(teamId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from("postman_app_installations").delete().eq("team_id", teamId);

    if (error) {
        throw new Error(`Failed to delete postman app installation: ${error.message}`);
    }
}
