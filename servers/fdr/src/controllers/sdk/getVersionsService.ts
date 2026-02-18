import { getLatestTag } from "@fern-api/github";

import { getLatestVersionFromNpm, getLatestVersionFromPypi } from "./getLatestVersion";

export type Language = "Go" | "TypeScript" | "Java" | "Python" | "Csharp" | "Ruby" | "Php" | "Swift" | "Rust";

export async function getExistingVersion({
    packageName,
    language,
    githubRepository
}: {
    packageName: string;
    language: Language;
    githubRepository: string | undefined;
}): Promise<string | undefined> {
    let version: string | undefined = undefined;

    // Step 1: Fetch from registries directly
    switch (language) {
        case "TypeScript":
            version = await getLatestVersionFromNpm(packageName);
            break;
        case "Python":
            version = await getLatestVersionFromPypi(packageName);
            break;
        case "Csharp":
            break;
        case "Go":
            break;
        case "Java":
            break;
        case "Ruby":
            break;
    }
    if (version != null) {
        return version;
    }

    // Step 2: Fetch from Github Tag
    if (githubRepository != null) {
        version = await getLatestTag(githubRepository);
    }

    return version;
}
