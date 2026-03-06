import type { Auth0OrgName } from "@/app/services/auth0/types";
import HealthPage from "@/components/health/HealthPage";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

// Auth is validated by the parent [docsUrl]/layout.tsx (session + org access + permissions).
export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }> }) {
    const params = await props.params;
    const docsUrl = parseDocsUrlParam({ docsUrl: params.docsUrl });
    return <HealthPage docsUrl={docsUrl} orgName={params.orgName} />;
}
