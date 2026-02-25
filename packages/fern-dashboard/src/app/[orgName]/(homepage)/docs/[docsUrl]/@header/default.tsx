import { getDocsSiteStatus } from "@/app/actions/setDocsSiteStatus";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { GoToEditorButton } from "@/components/docs-page/GoToEditorButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge, type StatusBadgeType } from "@/components/ui/StatusBadge";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";
import { HeaderActionsMenu } from "./HeaderActionsMenu";

export default async function DocsHeader({
    params
}: Readonly<{ params: Promise<{ docsUrl: EncodedDocsUrl; orgName: Auth0OrgName }> }>) {
    const { docsUrl: encodedDocsUrl, orgName } = await params;
    const session = (await getCurrentSession())!;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    // Parse domain and basepath from docsUrl
    const parts = docsUrl.split("/");
    const domain = parts[0] ?? docsUrl;
    const basepath = parts.length > 1 ? parts.slice(1).join("/") : undefined;

    const deploymentStatus = await getDocsSiteStatus({ domain, orgName, basepath });

    let badgeStatus: StatusBadgeType = "live";
    if (deploymentStatus === "UNPUBLISHED") {
        badgeStatus = "unpublished";
    }

    return (
        <PageHeader
            title={
                <span className="break-all">
                    <a
                        href={new URL(`https://${docsUrl}`).toString()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg hover:bg-gray-200 px-2 py-1 -mx-2 -my-1"
                    >
                        {docsUrl}
                    </a>
                </span>
            }
            titleRightContent={<StatusBadge status={badgeStatus} />}
            farRightContent={
                docsUrl && (
                    <div className="flex items-center gap-2">
                        <GoToEditorButton
                            docsUrl={docsUrl}
                            session={session}
                            disabled={false}
                            variant="default"
                            content={"Edit"}
                            isValidatingSource={false}
                        />
                        <HeaderActionsMenu
                            encodedDocsUrl={encodedDocsUrl}
                            docsUrl={docsUrl}
                            orgName={orgName}
                            token={session.accessToken}
                        />
                    </div>
                )
            }
        />
    );
}
