import { generatePrDescription } from "@/app/api/generate-pr-description/route";
import { getDocsUrlOwner } from "@/app/api/get-docs-url-owner/route";
import { getGithubSourceMetadata } from "@/app/api/get-github-source-metadata/route";
import { getMyOrganizations } from "@/app/api/get-my-organizations/route";
import { getOrgInvitations } from "@/app/api/get-org-invitations/route";
import { getOrgMembers } from "@/app/api/get-org-members/route";
import { getPrForBranch } from "@/app/api/get-pr-for-branch/route";
import { validateGithubBranch } from "@/app/api/get-validate-github-branch/route";
import { getHomepageImageUrl } from "@/app/api/homepage-images/get/route";
import { postDocsGithubSource } from "@/app/api/post-docs-github-source/route";
import { postGitCommit } from "@/app/api/post-git-commit/route";
import { postCreatePr } from "@/app/api/post-git-create-pr/route";
import { preloadEditorData } from "@/app/api/preload-editor-data/route";
import { generateSignedUploadUrl } from "@/app/api/signed-image-url/generate/route";
import { getSignedImageUrl } from "@/app/api/signed-image-url/get/route";
import { updatePrStatus } from "@/app/api/update-pr-status/route";
import { updatePrTitle } from "@/app/api/update-pr-title/route";

export const DashboardApiClient = {
  getMyOrganizations: () =>
    typedFetch<getMyOrganizations.Response>("/api/get-my-organizations"),
  getOrgInvitations: (request: getOrgInvitations.Request) =>
    typedFetch<getOrgInvitations.Response>("/api/get-org-invitations", request),
  getOrgMembers: (
    request: getOrgMembers.Request
  ): Promise<getOrgMembers.Response> =>
    typedFetch<getOrgMembers.Response>("/api/get-org-members", request),
  getHomepageImages: (request: getHomepageImageUrl.Request) =>
    typedFetch<getHomepageImageUrl.Response>(
      "/api/homepage-images/get",
      request
    ),
  getDocsUrlOwner: (request: getDocsUrlOwner.Request) =>
    typedFetch<getDocsUrlOwner.Response>("/api/get-docs-url-owner", request),
  postGitCommit: (request: postGitCommit.Request) =>
    typedFetch<postGitCommit.Response>("/api/post-git-commit", request),
  postCreatePr: (request: postCreatePr.Request) =>
    typedFetch<postCreatePr.Response>("/api/post-git-create-pr", request),
  generatePrDescription: (request: generatePrDescription.Request) =>
    typedFetch<generatePrDescription.Response>(
      "/api/generate-pr-description",
      request
    ),
  getGithubSourceMetadata: (request: getGithubSourceMetadata.Request) =>
    typedFetch<getGithubSourceMetadata.Response>(
      "/api/get-github-source-metadata",
      request
    ),
  postDocsGithubSource: (request: postDocsGithubSource.Request) =>
    typedFetch<postDocsGithubSource.Response>(
      "/api/post-docs-github-source",
      request
    ),
  validateGithubBranch: (request: validateGithubBranch.Request) =>
    typedFetch<validateGithubBranch.Response>(
      "/api/get-validate-github-branch",
      request
    ),
  preloadEditorData: (request: preloadEditorData.Request) =>
    typedFetch<preloadEditorData.Response>("/api/preload-editor-data", request),
  getPrForBranch: (request: getPrForBranch.Request) =>
    typedFetch<getPrForBranch.Response>("/api/get-pr-for-branch", request),
  updatePrTitle: (request: updatePrTitle.Request) =>
    typedFetch<updatePrTitle.Response>("/api/update-pr-title", request),
  updatePrStatus: (request: updatePrStatus.Request) =>
    typedFetch<updatePrStatus.Response>("/api/update-pr-status", request),
  generateSignedUploadUrl: (request: generateSignedUploadUrl.Request) =>
    typedFetch<generateSignedUploadUrl.Response>(
      "/api/signed-image-url/generate",
      request
    ),
  getSignedImageUrl: (request: getSignedImageUrl.Request) =>
    typedFetch<getSignedImageUrl.Response>(
      "/api/signed-image-url/get",
      request
    ),
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
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("Request failed", {
      url,
      body: JSON.stringify(body),
      status: response.status,
      statusText: response.statusText,
      responseText,
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
    console.error(
      "Failed to deserialize response",
      { url, body: JSON.stringify(body), responseText },
      e
    );
    throw new Error("Failed to deserialize response");
  }

  return json as T;
}
