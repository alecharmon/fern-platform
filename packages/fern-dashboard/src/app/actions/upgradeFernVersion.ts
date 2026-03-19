"use server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { DocsUrl } from "@/utils/types";

import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";
import { parseGitUrl } from "../services/git-common/url-utils";

function getAutopilotOrigin(): string {
    const origin = process.env.FERN_AUTOPILOT_ORIGIN;
    if (origin == null) {
        throw new Error("FERN_AUTOPILOT_ORIGIN is not defined in the current environment");
    }
    // Ensure the origin has a protocol prefix
    if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
        return `https://${origin}`;
    }
    return origin;
}

export async function upgradeFernVersionAction(
    orgName: Auth0OrgName,
    docsUrl: DocsUrl,
    gitUrl: string,
    currentVersion: string
): Promise<{
    success: boolean;
    error?: string;
    prUrl?: string;
    prNumber?: number;
}> {
    // 1. Check user session
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: "No session found" };
    }

    // 2. Check org membership
    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName);
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "User is not a member of the organization"
        };
    }

    // 3. Extract owner/repo from gitUrl
    const parsed = parseGitUrl(gitUrl);
    const owner = parsed.owner;
    const repo = parsed.provider === "github" ? parsed.repo : (parsed.path ?? parsed.repo);

    if (!owner || !repo) {
        return { success: false, error: "Invalid Git URL" };
    }

    try {
        // 4. Call fern-autopilot to run `fern upgrade` in a Lambda environment.
        // This ensures migrations are properly executed within the repo context.
        const autopilotOrigin = getAutopilotOrigin();

        const response = await fetch(`${autopilotOrigin}/api/upgrade-cli`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.accessToken}`
            },
            body: JSON.stringify({
                owner,
                repo,
                requestedBy: `Fern Dashboard (${orgName})`
            })
        });

        if (!response.ok) {
            let errorMessage = `Autopilot returned status ${response.status}`;
            try {
                const result = await response.json();
                errorMessage = result.error ?? errorMessage;
            } catch {
                // response body is not JSON (e.g. HTML from a load balancer)
            }
            return {
                success: false,
                error: errorMessage
            };
        }

        const result = await response.json();

        if (result.success) {
            const prNumber = extractPrNumber(result.pullRequestUrl);
            return {
                success: true,
                prUrl: result.pullRequestUrl,
                prNumber
            };
        }

        if (result.skipped) {
            return {
                success: false,
                error: result.skipReason ?? `CLI already at latest version (${currentVersion})`
            };
        }

        return {
            success: false,
            error: result.error ?? "Unknown error from autopilot"
        };
    } catch (error) {
        console.error("Failed to upgrade Fern version via autopilot", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}

function extractPrNumber(prUrl: string | undefined): number | undefined {
    if (!prUrl) {
        return undefined;
    }
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? Number(match[1]) : undefined;
}
