import { getDocsSiteStatus } from "@/app/actions/setDocsSiteStatus";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsHeaderClient } from "@/components/docs-page/DocsHeaderClient";
import type { StatusBadgeType } from "@/components/ui/StatusBadge";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";
import { HeaderActionsMenu } from "./HeaderActionsMenu";

/**
 * Thin server wrapper that resolves the session and deployment status,
 * then delegates to the client component. The client component's DOM stays stable across
 * tab navigations (React reconciliation sees no changes and skips the update),
 * avoiding any flash/thrash.
 */
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
        <DocsHeaderClient
            docsUrl={docsUrl}
            user={{ sub: session.user.sub, name: session.user.name }}
            badgeStatus={badgeStatus}
            actionsMenu={<HeaderActionsMenu docsUrl={docsUrl} orgName={orgName} token={session.accessToken} />}
        />
    );
}
