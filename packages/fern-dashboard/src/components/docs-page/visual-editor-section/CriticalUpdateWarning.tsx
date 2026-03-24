import { getDocsGithubMetadata } from "@/app/actions/getDocsGithubMetadata";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getFernVersionUpdateInfo } from "@/app/services/dal/github/getFernVersionUpdateInfo";
import { Note } from "@/components/ui/Note";
import type { DocsUrl } from "@/utils/types";
import { UpgradeFernButton } from "../UpgradeFernButton";

// TODO: This does not work for GitLab repos.
export async function CriticalUpdateWarning({
    orgName,
    docsUrl,
    gitUrl: inputGitUrl
}: {
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
    gitUrl?: string;
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
    const gitUrl = inputGitUrl ?? metadataResult.githubUrl;
    if (!gitUrl) {
        return null;
    }
    const fernVersionInfoResult = await getFernVersionUpdateInfo(gitUrl, docsUrl, baseBranch);

    const fernVersionInfo = fernVersionInfoResult.ok ? fernVersionInfoResult.result : undefined;

    const criticalCLIUpdateNeeded = fernVersionInfo?.isBelowMinimum;

    if (!fernVersionInfo || !criticalCLIUpdateNeeded || fernVersionInfo.latest === fernVersionInfo.current) {
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
                    gitUrl={gitUrl}
                    currentVersion={fernVersionInfo.current}
                    latestVersion={fernVersionInfo.latest}
                    baseBranch={baseBranch}
                />
            }
        />
    );
}
