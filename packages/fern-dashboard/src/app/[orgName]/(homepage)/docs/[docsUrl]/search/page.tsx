import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import SearchAnalyticsPage from "@/components/search-analytics/SearchAnalyticsPage";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: string }> }) {
    const params = await props.params;
    await getAuthenticatedSessionOrRedirect(params.orgName);

    return <SearchAnalyticsPage docsUrl={params.docsUrl} />;
}
