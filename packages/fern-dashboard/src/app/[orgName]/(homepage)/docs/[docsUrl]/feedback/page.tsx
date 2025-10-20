import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { FeedbackPage } from "@/components/feedback/FeedbackPage";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: string }> }) {
    const params = await props.params;
    await getAuthenticatedSessionOrRedirect(params.orgName);

    return <FeedbackPage docsUrl={params.docsUrl} />;
}
