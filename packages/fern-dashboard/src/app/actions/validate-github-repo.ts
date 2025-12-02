"use server";

import { validateGithubRepoAccess } from "@/app/services/dal/github/validators";
import type { DocsUrl } from "@/utils/types";

export async function validateGithubRepoAction(orgName: string, site: DocsUrl, githubUrl: string) {
    const result = await validateGithubRepoAccess(
        orgName,
        site,
        { type: "url", githubUrl },
        true // Always skip cache for polling
    );

    return result;
}
