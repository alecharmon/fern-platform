import { postToSlack } from "@fern-api/docs-server/slack";

import { getAppUrlServerSide } from "@/utils/getAppUrlServerSide";

import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export default async function requestOrgAccessHandler({
    docsUrl,
    email,
    token
}: {
    docsUrl: string;
    email: string;
    token: string;
}) {
    // Try to get the org ID from the docs URL
    const metadata = await getDocsUrlMetadata({ url: docsUrl, token });

    // To prevent org enumeration: don't reveal whether the org exists or not
    // We will only send notification if org actually exists
    if (metadata.ok) {
        const orgId = metadata.body.org;

        console.log("[requestOrgAccessHandler]", { docsUrl, orgId, email });

        const dashboardUrl = await getAppUrlServerSide();
        const notificationText = `*[${orgId}]* *<mailto:${email}|${email}>* requested access to Fern Dashboard :herb:\n\`${docsUrl}\``;
        const ctaText = "Add Member in Dashboard";
        const ctaUrl = `${dashboardUrl}/${orgId}/members?emailToInvite=${encodeURIComponent(email)}`;

        // Post to Slack notification channel
        postToSlack(
            "#dashboard-access-notifs",
            [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: notificationText
                    }
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: ctaText
                            },
                            url: ctaUrl
                        }
                    ]
                }
            ],
            "request-org-access"
        );
    } else {
        console.log(`[requestOrgAccessHandler] No org found for URL ${docsUrl} - skipping notification`);
    }

    return { success: true };
}
