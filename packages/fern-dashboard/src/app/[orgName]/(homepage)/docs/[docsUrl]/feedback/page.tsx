import { getFeedback } from "@/app/actions/getFeedback";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { FeedbackPage } from "@/components/feedback/FeedbackPage";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

// Auth is validated by the parent [docsUrl]/layout.tsx (session + org access + permissions).
export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }> }) {
    const params = await props.params;
    const docsUrl = parseDocsUrlParam({ docsUrl: params.docsUrl });

    let initialData;
    try {
        initialData = await getFeedback({
            docsUrl,
            dateRange: {
                type: "last_n_days",
                days: 7
            },
            page: 1,
            feedbackType: "page"
        });
    } catch (error: unknown) {
        // HANGING_PROMISE_REJECTION is expected during PPR prerendering (headers() unavailable)
        if (!(error instanceof Error && "digest" in error && String(error.digest) === "HANGING_PROMISE_REJECTION")) {
            console.error("Failed to preload feedback data:", error);
        }
    }

    return <FeedbackPage docsUrl={docsUrl} initialData={initialData} />;
}
