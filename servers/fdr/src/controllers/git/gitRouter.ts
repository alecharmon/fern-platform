import type { FdrAPI } from "@fern-api/fdr-sdk";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";
import type { FdrApplication } from "../../app";

const CheckRunSchema = z.object({
    checkId: z.string(),
    repositoryOwner: z.string(),
    repositoryName: z.string(),
    ref: z.string(),
    name: z.string(),
    status: z.string(),
    conclusion: z.string(),
    checkRunUrl: z.string(),
    createdAt: z.string(),
    completedAt: z.string().nullish(),
    rawCheckRun: z.unknown()
});

const GithubRepositoryIdSchema = z.object({
    id: z.string()
});

const RepositoryIdSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("github") }).merge(GithubRepositoryIdSchema)
]);

const BaseRepositorySchema = z.object({
    id: RepositoryIdSchema,
    name: z.string(),
    owner: z.string(),
    fullName: z.string(),
    url: z.string(),
    repositoryOwnerOrganizationId: z.string(),
    defaultBranchChecks: z.array(CheckRunSchema)
});

const SdkRepositorySchema = BaseRepositorySchema.extend({
    type: z.literal("sdk"),
    sdkLanguage: z.string()
});

const FernConfigRepositorySchema = BaseRepositorySchema.extend({
    type: z.literal("config")
});

const FernRepositorySchema = z.discriminatedUnion("type", [SdkRepositorySchema, FernConfigRepositorySchema]);

const GithubUserSchema = z.object({
    name: z.string().nullish(),
    email: z.string().nullish(),
    username: z.string()
});

const GithubTeamSchema = z.object({
    name: z.string(),
    teamId: z.string()
});

const PullRequestReviewerSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("user") }).merge(GithubUserSchema),
    z.object({ type: z.literal("team") }).merge(GithubTeamSchema)
]);

const PullRequestStateSchema = z.enum(["open", "closed", "merged"]);

const PullRequestSchema = z.object({
    pullRequestNumber: z.number().int(),
    repositoryName: z.string(),
    repositoryOwner: z.string(),
    author: GithubUserSchema.nullish(),
    reviewers: z.array(PullRequestReviewerSchema),
    title: z.string(),
    url: z.string(),
    checks: z.array(CheckRunSchema),
    state: PullRequestStateSchema,
    createdAt: z.string(),
    updatedAt: z.string().nullish(),
    mergedAt: z.string().nullish(),
    closedAt: z.string().nullish()
});

const ListRepositoriesResponseSchema = z.object({
    repositories: z.array(FernRepositorySchema)
});

const ListPullRequestsResponseSchema = z.object({
    pullRequests: z.array(PullRequestSchema)
});

export function createGitRouter(app: FdrApplication) {
    async function checkIsFernUser(authorization: string | undefined) {
        await app.services.auth.checkUserBelongsToOrg({
            authHeader: authorization,
            orgId: "fern"
        });
    }

    const getRepository = os
        .route({ method: "GET", path: "/repository/{repositoryOwner}/{repositoryName}" })
        .input(
            z.object({
                repositoryOwner: z.string(),
                repositoryName: z.string()
            })
        )
        .output(FernRepositorySchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            const maybeRepo = await app.dao.git().getRepository({
                repositoryName: input.repositoryName,
                repositoryOwner: input.repositoryOwner
            });
            if (!maybeRepo) {
                throw new ORPCError("NOT_FOUND", {
                    message: `Repository not found: ${input.repositoryOwner}/${input.repositoryName}`
                });
            }
            return maybeRepo;
        });

    const listRepositories = os
        .route({ method: "POST", path: "/repository/list" })
        .input(
            z.object({
                page: z.number().int().nullish(),
                pageSize: z.number().int().nullish(),
                organizationId: z.string().nullish(),
                repositoryName: z.string().nullish(),
                repositoryOwner: z.string().nullish()
            })
        )
        .output(ListRepositoriesResponseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            return await app.dao.git().listRepository({
                page: input.page ?? undefined,
                pageSize: input.pageSize ?? undefined,
                repositoryName: input.repositoryName ?? undefined,
                repositoryOwner: input.repositoryOwner ?? undefined,
                organizationId: input.organizationId ?? undefined
            });
        });

    const upsertRepository = os
        .route({ method: "PUT", path: "/repository/upsert" })
        .input(FernRepositorySchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            await app.dao.git().upsertRepository({ repository: input as unknown as FdrAPI.FernRepository });
        });

    const deleteRepository = os
        .route({ method: "DELETE", path: "/repository/{repositoryOwner}/{repositoryName}/delete" })
        .input(
            z.object({
                repositoryOwner: z.string(),
                repositoryName: z.string()
            })
        )
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            await app.dao.git().deleteRepository({
                repositoryName: input.repositoryName,
                repositoryOwner: input.repositoryOwner
            });
        });

    const getPullRequest = os
        .route({ method: "GET", path: "/pull-request/{repositoryOwner}/{repositoryName}/{pullRequestNumber}" })
        .input(
            z.object({
                repositoryOwner: z.string(),
                repositoryName: z.string(),
                pullRequestNumber: z.coerce.number().int()
            })
        )
        .output(PullRequestSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            const maybePull = await app.dao.git().getPullRequest({
                repositoryName: input.repositoryName,
                repositoryOwner: input.repositoryOwner,
                pullRequestNumber: input.pullRequestNumber
            });
            if (!maybePull) {
                throw new ORPCError("NOT_FOUND", {
                    message: `Pull request not found: ${input.repositoryOwner}/${input.repositoryName}#${input.pullRequestNumber}`
                });
            }
            return maybePull;
        });

    const listPullRequests = os
        .route({ method: "POST", path: "/pull-request/list" })
        .input(
            z.object({
                page: z.number().int().nullish(),
                pageSize: z.number().int().nullish(),
                repositoryName: z.string().nullish(),
                repositoryOwner: z.string().nullish(),
                organizationId: z.string().nullish(),
                state: z.array(PullRequestStateSchema).nullish(),
                author: z.array(z.string()).nullish()
            })
        )
        .output(ListPullRequestsResponseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            return await app.dao.git().listPullRequests({
                page: input.page ?? undefined,
                pageSize: input.pageSize ?? undefined,
                repositoryName: input.repositoryName ?? undefined,
                repositoryOwner: input.repositoryOwner ?? undefined,
                organizationId: input.organizationId ?? undefined,
                state: input.state ?? undefined,
                author: input.author ?? undefined
            });
        });

    const upsertPullRequest = os
        .route({ method: "PUT", path: "/pull-request/upsert" })
        .input(PullRequestSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            await app.dao.git().upsertPullRequest({ pullRequest: input as unknown as FdrAPI.PullRequest });
        });

    const deletePullRequest = os
        .route({
            method: "DELETE",
            path: "/pull-request/{repositoryOwner}/{repositoryName}/{pullRequestNumber}/delete"
        })
        .input(
            z.object({
                repositoryOwner: z.string(),
                repositoryName: z.string(),
                pullRequestNumber: z.coerce.number().int()
            })
        )
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            await app.dao.git().deletePullRequest({
                repositoryName: input.repositoryName,
                repositoryOwner: input.repositoryOwner,
                pullRequestNumber: input.pullRequestNumber
            });
        });

    return {
        getRepository,
        listRepositories,
        upsertRepository,
        deleteRepository,
        getPullRequest,
        listPullRequests,
        upsertPullRequest,
        deletePullRequest
    };
}
