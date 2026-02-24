import { oc } from "@orpc/contract";
import * as z from "zod";

// ── Data schemas ────────────────────────────────────────────────────────

export const CheckRunSchema = z.object({
    checkId: z.string(),
    repositoryOwner: z.string(),
    repositoryName: z.string(),
    ref: z.string(),
    name: z.string(),
    status: z.string(),
    conclusion: z.string(),
    checkRunUrl: z.string(),
    createdAt: z.string(),
    completedAt: z.string().optional(),
    rawCheckRun: z.unknown()
});

export const GithubRepositoryIdSchema = z.object({
    id: z.string()
});

export const RepositoryIdSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("github") }).merge(GithubRepositoryIdSchema)
]);

export const BaseRepositorySchema = z.object({
    id: RepositoryIdSchema,
    name: z.string(),
    owner: z.string(),
    fullName: z.string(),
    url: z.string(),
    repositoryOwnerOrganizationId: z.string(),
    defaultBranchChecks: z.array(CheckRunSchema)
});

export const SdkRepositorySchema = BaseRepositorySchema.extend({
    type: z.literal("sdk"),
    sdkLanguage: z.string()
});

export const FernConfigRepositorySchema = BaseRepositorySchema.extend({
    type: z.literal("config")
});

export const FernRepositorySchema = z.discriminatedUnion("type", [SdkRepositorySchema, FernConfigRepositorySchema]);

export const GithubUserSchema = z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    username: z.string()
});

export const GithubTeamSchema = z.object({
    name: z.string(),
    teamId: z.string()
});

export const PullRequestReviewerSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("user") }).merge(GithubUserSchema),
    z.object({ type: z.literal("team") }).merge(GithubTeamSchema)
]);

export const PullRequestStateSchema = z.enum(["open", "closed", "merged"]);

export const PullRequestState = {
    Open: "open",
    Closed: "closed",
    Merged: "merged"
} as const;

export const PullRequestSchema = z.object({
    pullRequestNumber: z.number().int(),
    repositoryName: z.string(),
    repositoryOwner: z.string(),
    author: GithubUserSchema.optional(),
    reviewers: z.array(PullRequestReviewerSchema),
    title: z.string(),
    url: z.string(),
    checks: z.array(CheckRunSchema),
    state: PullRequestStateSchema,
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    mergedAt: z.string().optional(),
    closedAt: z.string().optional()
});

export const ListRepositoriesResponseSchema = z.object({
    repositories: z.array(FernRepositorySchema)
});

export const ListPullRequestsResponseSchema = z.object({
    pullRequests: z.array(PullRequestSchema)
});

// ── Input schemas ───────────────────────────────────────────────────────

export const GetRepositoryInputSchema = z.object({
    repositoryOwner: z.string(),
    repositoryName: z.string()
});

export const ListRepositoriesInputSchema = z.object({
    page: z.number().int().optional(),
    pageSize: z.number().int().optional(),
    organizationId: z.string().optional(),
    repositoryName: z.string().optional(),
    repositoryOwner: z.string().optional()
});

export const DeleteRepositoryInputSchema = z.object({
    repositoryOwner: z.string(),
    repositoryName: z.string()
});

export const GetPullRequestInputSchema = z.object({
    repositoryOwner: z.string(),
    repositoryName: z.string(),
    pullRequestNumber: z.coerce.number().int()
});

export const ListPullRequestsInputSchema = z.object({
    page: z.number().int().optional(),
    pageSize: z.number().int().optional(),
    repositoryName: z.string().optional(),
    repositoryOwner: z.string().optional(),
    organizationId: z.string().optional(),
    state: z.array(PullRequestStateSchema).optional(),
    author: z.array(z.string()).optional()
});

export const DeletePullRequestInputSchema = z.object({
    repositoryOwner: z.string(),
    repositoryName: z.string(),
    pullRequestNumber: z.coerce.number().int()
});

// ── Inferred types ──────────────────────────────────────────────────────

export type CheckRun = z.infer<typeof CheckRunSchema>;
export type GithubRepositoryId = z.infer<typeof GithubRepositoryIdSchema>;
export type RepositoryId = z.infer<typeof RepositoryIdSchema>;
export type BaseRepository = z.infer<typeof BaseRepositorySchema>;
export type SdkRepository = z.infer<typeof SdkRepositorySchema>;
export type FernConfigRepository = z.infer<typeof FernConfigRepositorySchema>;
export type FernRepository = z.infer<typeof FernRepositorySchema>;
export type GithubUser = z.infer<typeof GithubUserSchema>;
export type GithubTeam = z.infer<typeof GithubTeamSchema>;
export type PullRequestReviewer = z.infer<typeof PullRequestReviewerSchema>;
export type PullRequestState = z.infer<typeof PullRequestStateSchema>;
export type PullRequest = z.infer<typeof PullRequestSchema>;
export type ListRepositoriesResponse = z.infer<typeof ListRepositoriesResponseSchema>;
export type ListPullRequestsResponse = z.infer<typeof ListPullRequestsResponseSchema>;
export type GetRepositoryInput = z.infer<typeof GetRepositoryInputSchema>;
export type ListRepositoriesInput = z.infer<typeof ListRepositoriesInputSchema>;
export type DeleteRepositoryInput = z.infer<typeof DeleteRepositoryInputSchema>;
export type GetPullRequestInput = z.infer<typeof GetPullRequestInputSchema>;
export type ListPullRequestsInput = z.infer<typeof ListPullRequestsInputSchema>;
export type DeletePullRequestInput = z.infer<typeof DeletePullRequestInputSchema>;

// ── Contract ────────────────────────────────────────────────────────────

export const gitContract = {
    getRepository: oc
        .route({ method: "GET", path: "/repository/{repositoryOwner}/{repositoryName}" })
        .input(GetRepositoryInputSchema)
        .output(FernRepositorySchema),

    listRepositories: oc
        .route({ method: "POST", path: "/repository/list" })
        .input(ListRepositoriesInputSchema)
        .output(ListRepositoriesResponseSchema),

    upsertRepository: oc.route({ method: "PUT", path: "/repository/upsert" }).input(FernRepositorySchema),

    deleteRepository: oc
        .route({ method: "DELETE", path: "/repository/{repositoryOwner}/{repositoryName}/delete" })
        .input(DeleteRepositoryInputSchema),

    getPullRequest: oc
        .route({ method: "GET", path: "/pull-request/{repositoryOwner}/{repositoryName}/{pullRequestNumber}" })
        .input(GetPullRequestInputSchema)
        .output(PullRequestSchema),

    listPullRequests: oc
        .route({ method: "POST", path: "/pull-request/list" })
        .input(ListPullRequestsInputSchema)
        .output(ListPullRequestsResponseSchema),

    upsertPullRequest: oc.route({ method: "PUT", path: "/pull-request/upsert" }).input(PullRequestSchema),

    deletePullRequest: oc
        .route({
            method: "DELETE",
            path: "/pull-request/{repositoryOwner}/{repositoryName}/{pullRequestNumber}/delete"
        })
        .input(DeletePullRequestInputSchema)
};
