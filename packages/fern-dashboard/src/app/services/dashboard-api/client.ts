import type { getAuthZPermissions } from "@/app/api/authz/[orgName]/permissions/route";
import type { generatePrDescription } from "@/app/api/generate-pr-description/route";
import type { getDocsGitUrl } from "@/app/api/get-docs-github-url/route";
import type { getDocsSites } from "@/app/api/get-docs-sites/route";
import type { getDocsUrlOwner } from "@/app/api/get-docs-url-owner/route";
import type { getMyOrganizations } from "@/app/api/get-my-organizations/route";
import type { getOrgInvitations } from "@/app/api/get-org-invitations/route";
import type { getOrgMembers } from "@/app/api/get-org-members/route";
import type { getUserResourceRoles } from "@/app/api/get-user-resource-roles/route";
import type { validateGithubBranch } from "@/app/api/get-validate-github-branch/route";
import type { postDocsGithubSource } from "@/app/api/post-docs-github-source/route";
import type { postCreatePr } from "@/app/api/post-git-create-pr/route";
import type { generateSignedUploadUrl } from "@/app/api/signed-image-url/generate/route";
import type { getSignedImageUrl } from "@/app/api/signed-image-url/get/route";
import type { updatePrTitle } from "@/app/api/update-pr-title/route";
import type { updateUserRoles } from "@/app/api/update-user-roles/route";
import type { ValidateGitRepo } from "@/app/api/validate-git-repo/route";

export const DashboardApiClient = {
    getAuthZPermissions: (orgName: string) =>
        typedFetch<getAuthZPermissions.Response>(`/api/authz/${encodeURIComponent(orgName)}/permissions`),
    getDocsSites: (request: getDocsSites.Request) => typedFetch<getDocsSites.Response>("/api/get-docs-sites", request),
    getUserResourceRoles: (request: getUserResourceRoles.Request) =>
        typedFetch<getUserResourceRoles.Response>("/api/get-user-resource-roles", request),
    getMyOrganizations: () => typedFetch<getMyOrganizations.Response>("/api/get-my-organizations"),
    getOrgInvitations: (request: getOrgInvitations.Request) =>
        typedFetch<getOrgInvitations.Response>("/api/get-org-invitations", request),
    getOrgMembers: (request: getOrgMembers.Request): Promise<getOrgMembers.Response> =>
        typedFetch<getOrgMembers.Response>("/api/get-org-members", request),
    getDocsUrlOwner: (request: getDocsUrlOwner.Request) =>
        typedFetch<getDocsUrlOwner.Response>("/api/get-docs-url-owner", request),
    getDocsGitUrl: (request: getDocsGitUrl.Request) =>
        typedFetch<getDocsGitUrl.Response>("/api/get-docs-github-url", request),
    postCreatePr: (request: postCreatePr.Request) =>
        typedFetch<postCreatePr.Response>("/api/post-git-create-pr", request),
    generatePrDescription: (request: generatePrDescription.Request) =>
        typedFetch<generatePrDescription.Response>("/api/generate-pr-description", request),
    postDocsGithubSource: (request: postDocsGithubSource.Request) =>
        typedFetch<postDocsGithubSource.Response>("/api/post-docs-github-source", request),
    validateGithubBranch: (request: validateGithubBranch.Request) =>
        typedFetch<validateGithubBranch.Response>("/api/get-validate-github-branch", request),
    validateGitRepo: (request: ValidateGitRepo.Request) =>
        typedFetch<ValidateGitRepo.Response>("/api/validate-git-repo", request),
    updatePrTitle: (request: updatePrTitle.Request) =>
        typedFetch<updatePrTitle.Response>("/api/update-pr-title", request),
    generateSignedUploadUrl: (request: generateSignedUploadUrl.Request) =>
        typedFetch<generateSignedUploadUrl.Response>("/api/signed-image-url/generate", request),
    getSignedImageUrl: (request: getSignedImageUrl.Request) =>
        typedFetch<getSignedImageUrl.Response>("/api/signed-image-url/get", request),
    updateUserRoles: (request: updateUserRoles.Request) =>
        typedFetch<updateUserRoles.Response>("/api/update-user-roles", request)
};

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly body: string,
        message?: string
    ) {
        super(message || `Request failed: ${status} ${statusText}`);
        this.name = "ApiError";
    }
}

async function typedFetch<T>(
    url: string,
    body?: unknown,
    { method = body != null ? "POST" : "GET" }: { method?: "GET" | "POST" } = {}
): Promise<T> {
    const response = await fetch(url, {
        method: method,
        body: body != null ? JSON.stringify(body) : undefined
    });

    const responseText = await response.text().catch(() => "");

    if (!response.ok) {
        console.error("Request failed", {
            url,
            body: JSON.stringify(body),
            status: response.status,
            statusText: response.statusText,
            responseText
        });

        throw new ApiError(
            response.status,
            response.statusText,
            responseText,
            `Request failed: ${response.status} ${response.statusText}`
        );
    }

    let json: unknown;
    try {
        json = JSON.parse(responseText);
    } catch (e) {
        console.error("Failed to deserialize response", { url, body: JSON.stringify(body), responseText }, e);
        throw new Error("Failed to deserialize response");
    }

    return json as T;
}
