import { getDocsGithubMetadata } from "@/app/actions/getDocsGithubMetadata";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getFernVersionUpdateInfo } from "@/app/services/dal/github/getFernVersionUpdateInfo";
import type { DocsUrl } from "@/utils/types";
import { Note } from "../Note";
import { UpgradeFernButton } from "../UpgradeFernButton";

export async function CriticalUpdateWarning({
    orgName,
    docsUrl,
    githubUrl: inputGithubUrl
}: {
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
    githubUrl?: string;
    baseBranch?: string;
}) {
    const metadataResult = await getDocsGithubMetadata(docsUrl);
    if (!metadataResult.success) {
        return null;
    }
    const baseBranch = metadataResult.baseBranch;
    if (!baseBranch) {
        return null;
    }
    const githubUrl = inputGithubUrl ?? metadataResult.githubUrl;
    if (!githubUrl) {
        return null;
    }
    const fernVersionInfoResult = await getFernVersionUpdateInfo(githubUrl, docsUrl, baseBranch);

    const fernVersionInfo = fernVersionInfoResult.ok ? fernVersionInfoResult.result : undefined;

    const criticalCLIUpdateNeeded = fernVersionInfo?.isBelowMinimum;

    if (!fernVersionInfo || !criticalCLIUpdateNeeded) {
        return null;
    }

    return (
        <Note
            variant="error"
            className="py-3"
            title="Your Fern CLI version is incompatible"
            subtitle="Upgrade to use the latest features of the Fern Editor."
            rightContent={
                <UpgradeFernButton
                    variant="black"
                    orgName={orgName}
                    docsUrl={docsUrl}
                    githubUrl={githubUrl}
                    currentVersion={fernVersionInfo.current}
                    latestVersion={fernVersionInfo.latest}
                    baseBranch={baseBranch}
                />
            }
        />
    );
}
