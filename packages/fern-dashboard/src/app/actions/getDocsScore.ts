"use server";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

function getDocsLambdaOrigin(): string {
    return (
        process.env.DEFAULT_FDR_LAMBDA_DOCS_ORIGIN ??
        "https://ykq45y6fvnszd35iv5yuuatkze0rpwuz.lambda-url.us-east-1.on.aws"
    );
}

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface DocsScoreIssue {
    page: string;
    issueType: string;
    suggestedFix: string;
    severity: IssueSeverity;
}

export interface IssueCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
}

export interface DocsScoreData {
    issueCounts: IssueCounts;
    issues: DocsScoreIssue[];
}

export interface DocsScoreResponse {
    domain: string;
    isProcessing: boolean;
    updatedAt: string;
    data: DocsScoreData | null;
}

export async function getDocsScore(domain: string, orgName: Auth0OrgName): Promise<DocsScoreResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const baseUrl = getDocsLambdaOrigin();
    const requestUrl = `${baseUrl}/docs-score?domain=${encodeURIComponent(domain)}`;
    const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${session.accessToken}`
        }
    });

    if (response.status === 404) {
        return {
            domain,
            isProcessing: false,
            updatedAt: new Date().toISOString(),
            data: null
        };
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch docs score: ${response.statusText}`);
    }

    return response.json();
}

export async function triggerDocsScore(domain: string, orgName: Auth0OrgName): Promise<DocsScoreResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const baseUrl = getDocsLambdaOrigin();

    // POST triggers calculation and returns current state (isProcessing: true)
    const response = await fetch(`${baseUrl}/docs-score`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ domain })
    });

    if (response.status === 404) {
        return {
            domain,
            isProcessing: true,
            updatedAt: new Date().toISOString(),
            data: null
        };
    }

    if (!response.ok) {
        throw new Error(`Failed to trigger docs score: ${response.statusText}`);
    }

    return response.json();
}
