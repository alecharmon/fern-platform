import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getFernVersionUpdateInfo } from "@/app/services/dal/github/getFernVersionUpdateInfo";
import type { DocsUrl } from "@/utils/types";
import { FernIcon } from "../theme/FernIcon";
import { UpgradeFernButton } from "./UpgradeFernButton";

export async function FernCliVersionDisplay({
    githubUrl,
    docsUrl,
    baseBranch,
    orgName
}: {
    githubUrl?: string;
    docsUrl: DocsUrl;
    baseBranch?: string;
    orgName: Auth0OrgName;
}) {
    if (githubUrl == null || baseBranch == null) {
        return null;
    }
    const fernVersionInfoResult = await getFernVersionUpdateInfo(githubUrl, docsUrl, baseBranch);

    if (!fernVersionInfoResult.ok) {
        return null;
    }

    const fernVersionInfo = fernVersionInfoResult.result;

    return (
        <div className="text-gray-1100 flex items-center gap-2">
            <FernIcon className="size-5" fill="fill-gray-800" /> {fernVersionInfo?.current}
            {fernVersionInfo?.needsUpgrade && (
                <UpgradeFernButton
                    orgName={orgName}
                    docsUrl={docsUrl}
                    githubUrl={githubUrl}
                    currentVersion={fernVersionInfo.current}
                    latestVersion={fernVersionInfo.latest}
                    baseBranch={baseBranch}
                    existingPr={fernVersionInfo.existingPr}
                    abbreviateText
                />
            )}
        </div>
    );
}
