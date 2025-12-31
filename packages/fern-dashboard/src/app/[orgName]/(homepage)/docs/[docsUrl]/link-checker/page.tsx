import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import LinkCheckerPage from "@/components/link-checker/LinkCheckerPage";
import type { DocsUrl } from "@/utils/types";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: string }> }) {
    const params = await props.params;
    await getAuthenticatedSessionOrRedirect(params.orgName);

    return <LinkCheckerPage docsUrl={params.docsUrl as DocsUrl} orgName={params.orgName} />;
}
