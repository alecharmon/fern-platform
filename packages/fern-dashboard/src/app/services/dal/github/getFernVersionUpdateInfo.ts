import "server-only";

import { MIN_VE_CLI_VERSION, compareVersions, getLatestFernCliVersion } from "@/utils/fernCliVersion";
import type { DocsUrl } from "@/utils/types";

import { checkUpgradePrStatus } from "./checkUpgradePrStatus";
import { type GetFernVersionFromRepoError, getFernVersionFromRepo } from "./getFernVersionFromRepo";

export type GetFernVersionUpdateInfoResult = {
    current: string;
    latest: string;
    needsUpgrade: boolean;
    isBelowMinimum: boolean;
    existingPr?: {
        exists: boolean;
        prUrl?: string;
        prNumber?: number;
    };
};

export type GetFernVersionUpdateInfoError = GetFernVersionFromRepoError | { type: "MALFORMED_INPUT" };

export async function getFernVersionUpdateInfo({
    githubUrl,
    docsUrl,
    baseBranch
}: {
    githubUrl?: string;
    docsUrl?: DocsUrl;
    baseBranch?: string;
}): Promise<
    { ok: true; result: GetFernVersionUpdateInfoResult } | { ok: false; error: GetFernVersionUpdateInfoError }
> {
    "use cache";
    if (githubUrl == null || baseBranch == null || docsUrl == null) {
        return { ok: false, error: { type: "MALFORMED_INPUT" } };
    }

    const [fernVersionResult, latestVersion] = await Promise.all([
        getFernVersionFromRepo(githubUrl, docsUrl),
        getLatestFernCliVersion()
    ]);

    if (!fernVersionResult.ok) {
        return { ok: false, error: fernVersionResult.error };
    }

    const needsUpgrade = compareVersions(fernVersionResult.version, latestVersion);
    const isBelowMinimum = compareVersions(fernVersionResult.version, MIN_VE_CLI_VERSION);

    let existingPr;

    // Show version info if any update is available
    if (needsUpgrade) {
        // Check if there's already an existing upgrade PR
        existingPr = await checkUpgradePrStatus(githubUrl, fernVersionResult.version, latestVersion, baseBranch);
    }
    return {
        ok: true,
        result: {
            current: fernVersionResult.version,
            latest: latestVersion,
            needsUpgrade,
            isBelowMinimum,
            existingPr
        }
    };
}
