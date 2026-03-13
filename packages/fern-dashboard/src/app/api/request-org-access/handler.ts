import { postToSlackImmediate } from "@fern-api/docs-server/slack";
import { revalidateTag } from "next/cache";

import * as auth0Management from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { getAppUrlServerSide } from "@/utils/getAppUrlServerSide";
import type { DocsUrl } from "@/utils/types";
import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

/**
 * Extracts the domain from an email address.
 * e.g., "john@acme.com" -> "acme.com"
 */
function getEmailDomain(email: string): string | undefined {
    const parts = email.split("@");
    if (parts.length !== 2) {
        return undefined;
    }
    return parts[1]?.toLowerCase();
}

/**
 * Extracts the domain from a URL.
 * e.g., "https://docs.acme.com/learn" -> "docs.acme.com"
 */
function getUrlDomain(url: string): string | undefined {
    try {
        let urlToParse = url;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            urlToParse = `https://${url}`;
        }
        const parsed = new URL(urlToParse);
        return parsed.hostname.toLowerCase();
    } catch {
        return undefined;
    }
}

/**
 * Checks if the email domain matches the docs URL domain.
 * Handles subdomains: docs.acme.com matches acme.com email domain.
 */
function doDomainsMatch(emailDomain: string, urlDomain: string): boolean {
    // Exact match
    if (emailDomain === urlDomain) {
        return true;
    }

    // Check if URL domain ends with the email domain (subdomain match)
    // e.g., docs.acme.com ends with .acme.com
    if (urlDomain.endsWith(`.${emailDomain}`)) {
        return true;
    }

    return false;
}

export default async function requestOrgAccessHandler({
    docsUrl,
    email,
    token
}: {
    docsUrl: DocsUrl;
    email: string;
    token: string;
}): Promise<{ success: true; autoApproved?: boolean }> {
    // Try to get the org ID from the docs URL
    const metadata = await getDocsUrlMetadata({ url: docsUrl, token });

    // To prevent org enumeration: don't reveal whether the org exists or not
    // We will only send notification if org actually exists
    if (metadata.ok) {
        const orgId = metadata.body.org;

        console.log("[requestOrgAccessHandler]", { docsUrl, orgId, email });

        const emailDomain = getEmailDomain(email);
        const urlDomain = getUrlDomain(docsUrl);

        // Check if email domain matches docs URL domain for auto-approval
        if (emailDomain && urlDomain && doDomainsMatch(emailDomain, urlDomain)) {
            console.log("[requestOrgAccessHandler] Email domain matches docs URL domain, auto-approving", {
                emailDomain,
                urlDomain
            });

            let autoApproved = false;

            try {
                const userId = await auth0Management.getUserIdByEmail(email);
                await auth0Management.addUserToOrg(userId, Auth0OrgName(orgId));

                // Assign a default editor role so the user has access immediately
                try {
                    const auth0OrgId = await auth0Management.getOrgIdFromName(Auth0OrgName(orgId));
                    await auth0Management.assignRoleToOrgMember(userId, auth0OrgId, ["editor"]);
                } catch (roleErr) {
                    console.error(
                        "[requestOrgAccessHandler] Failed to assign editor role during auto-approval",
                        roleErr
                    );
                }

                revalidateTag(`permissions:${orgId}:${userId}`);
                autoApproved = true;
            } catch (err) {
                console.error(
                    "[requestOrgAccessHandler] Auto-approval failed during Auth0 operations, falling back to manual flow",
                    err
                );
            }

            if (autoApproved) {
                // Best-effort Slack notification; don't let failures here flip us into the manual path
                try {
                    await postToSlackImmediate(
                        "#dashboard-access-notifs",
                        `*[${orgId}]* Auto-approved *<mailto:${email}|${email}>* :white_check_mark:\n\`${docsUrl}\``,
                        "request-org-access"
                    );
                } catch (err) {
                    console.error("[requestOrgAccessHandler] Failed to post auto-approve Slack notification", err);
                }

                return { success: true, autoApproved: true };
            }

            // If we reach here, auto-approval (Auth0 side) has genuinely failed, so fall through to manual flow
        }

        const dashboardUrl = await getAppUrlServerSide();
        const notificationText = `*[${orgId}]* *<mailto:${email}|${email}>* requested access to Fern Dashboard :herb:\n\`${docsUrl}\``;
        const ctaText = "Add Member in Dashboard";
        const ctaUrl = `${dashboardUrl}/${orgId}/members?emailToInvite=${encodeURIComponent(email)}`;

        // Post to Slack notification channel for manual approval (using immediate version to ensure it completes)
        await postToSlackImmediate(
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
