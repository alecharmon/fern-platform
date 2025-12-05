import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { GetFernVersionUpdateInfoResult } from "@/app/services/dal/github/getFernVersionUpdateInfo";
import type { DocsUrl } from "@/utils/types";
import { FernIcon } from "../theme/FernIcon";
import { UpgradeFernButton } from "./UpgradeFernButton";

export function FernCliVersionDisplay({
    gitUrl,
    docsUrl,
    baseBranch,
    orgName,
    fernVersionInfo
}: {
    gitUrl: string;
    docsUrl: DocsUrl;
    baseBranch: string;
    orgName: Auth0OrgName;
    fernVersionInfo: GetFernVersionUpdateInfoResult;
}) {
    return (
        <div className="text-gray-1100 flex items-center gap-2">
            <FernIcon className="size-5" fill="fill-gray-800" /> {fernVersionInfo?.current}
            {fernVersionInfo?.needsUpgrade && (
                <UpgradeFernButton
                    orgName={orgName}
                    docsUrl={docsUrl}
                    gitUrl={gitUrl}
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
