"use server";

import { validateGitRepoAccess } from "@/app/services/dal/git/validators";

export async function validateGithubRepoAction(orgName: string, site: string, gitUrl: string) {
    const result = await validateGitRepoAccess(
        orgName,
        site,
        { type: "url", gitUrl },
        true // Always skip cache for polling
    );

    return result;
}
