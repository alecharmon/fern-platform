"use server";

import { validateGitRepoAccess } from "@/app/services/dal/github/validators";
import type { DocsUrl } from "@/utils/types";

export async function validateGitRepoAction(orgName: string, site: DocsUrl, gitUrl: string) {
    const result = await validateGitRepoAccess(
        orgName,
        site,
        { type: "url", gitUrl },
        true // Always skip cache for polling
    );

    return result;
}
