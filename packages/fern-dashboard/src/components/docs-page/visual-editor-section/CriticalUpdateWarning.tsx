import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getFernVersionUpdateInfo } from "@/app/services/dal/github/getFernVersionUpdateInfo";
import type { DocsUrl } from "@/utils/types";

import { UpgradeFernButton } from "../UpgradeFernButton";
import { WarningNote } from "../WarningNote";

export async function CriticalUpdateWarning({
    orgName,
    docsUrl,
    githubUrl,
    baseBranch
}: {
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
    githubUrl?: string;
    baseBranch?: string;
}) {
    if (githubUrl == null || baseBranch == null) {
        return null;
    }
    const fernVersionInfoResult = await getFernVersionUpdateInfo(githubUrl, docsUrl, baseBranch);

    const fernVersionInfo = fernVersionInfoResult.ok ? fernVersionInfoResult.result : undefined;

    const criticalCLIUpdateNeeded = fernVersionInfo?.isBelowMinimum;

    if (!fernVersionInfo || !criticalCLIUpdateNeeded) {
        return null;
    }

    return (
        <WarningNote variant="error" className="py-3">
            <div className="flex flex-wrap justify-between gap-4">
                <div className="flex flex-col">
                    <p className="text-md">Your Fern CLI version is incompatible</p>
                    <p className="text-muted-foreground text-xs">
                        Upgrade to use the latest features of the Fern Editor.
                    </p>
                </div>
                <div>
                    <UpgradeFernButton
                        variant="black"
                        orgName={orgName}
                        docsUrl={docsUrl}
                        githubUrl={githubUrl}
                        currentVersion={fernVersionInfo.current}
                        latestVersion={fernVersionInfo.latest}
                        baseBranch={baseBranch}
                    />
                </div>
            </div>
        </WarningNote>
    );
}
