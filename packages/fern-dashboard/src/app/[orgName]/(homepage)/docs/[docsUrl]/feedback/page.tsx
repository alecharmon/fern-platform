import { getFeedback } from "@/app/actions/getFeedback";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { FeedbackPage } from "@/components/feedback/FeedbackPage";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: string }> }) {
    const params = await props.params;
    await getAuthenticatedSessionOrRedirect(params.orgName);

    let initialData;
    try {
        initialData = await getFeedback({
            docsUrl: params.docsUrl,
            dateRange: {
                type: "last_n_days",
                days: 7
            },
            page: 1,
            feedbackType: "page"
        });
    } catch (error) {
        console.error("Failed to preload feedback data:", error);
    }

    return <FeedbackPage docsUrl={params.docsUrl} initialData={initialData} />;
}
