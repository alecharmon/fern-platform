import { Auth0OrgName } from "@/app/services/auth0/types";
import { getFernVersionUpdateInfo } from "@/app/services/dal/github/getFernVersionUpdateInfo";
import { DocsUrl } from "@/utils/types";

import { FernIcon } from "../theme/FernIcon";
import { UpgradeFernButton } from "./UpgradeFernButton";

export async function FernCliVersionDisplay({
  githubUrl,
  docsUrl,
  baseBranch,
  orgName,
}: {
  githubUrl?: string;
  docsUrl: DocsUrl;
  baseBranch?: string;
  orgName: Auth0OrgName;
}) {
  const fernVersionInfoResult = await getFernVersionUpdateInfo({
    githubUrl,
    docsUrl,
    baseBranch,
  });

  if (!fernVersionInfoResult.ok || githubUrl == null || baseBranch == null) {
    return null;
  }

  const fernVersionInfo = fernVersionInfoResult.ok
    ? fernVersionInfoResult.result
    : undefined;

  return (
    <div className="flex w-fit flex-col gap-2">
      <p>Fern CLI Version</p>
      <div className="text-gray-1100 flex items-center gap-2">
        <FernIcon className="size-5" fill="fill-gray-800" />{" "}
        {fernVersionInfo?.current}
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
    </div>
  );
}
