import type {
    DeletePullRequestInputSchema,
    DeleteRepositoryInputSchema,
    FernRepository,
    FernRepositorySchema,
    GetPullRequestInputSchema,
    GetRepositoryInputSchema,
    ListPullRequestsInputSchema,
    ListPullRequestsResponseSchema,
    ListRepositoriesInputSchema,
    ListRepositoriesResponseSchema,
    PullRequest,
    PullRequestSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";
import type { FdrApplication } from "../../app";

export function createGitRouter(app: FdrApplication) {
    async function checkIsFernUser(authorization: string | undefined) {
        await app.services.auth.checkUserBelongsToOrg({
            authHeader: authorization,
            orgId: "fern"
        });
    }

    const getRepository = os
        .route({ method: "GET", path: "/repository/{repositoryOwner}/{repositoryName}" })
        .input(z.custom<z.infer<typeof GetRepositoryInputSchema>>())
        .output(z.custom<z.infer<typeof FernRepositorySchema>>())
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
        .input(z.custom<z.infer<typeof ListRepositoriesInputSchema>>())
        .output(z.custom<z.infer<typeof ListRepositoriesResponseSchema>>())
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
        .input(z.custom<z.infer<typeof FernRepositorySchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            await app.dao.git().upsertRepository({ repository: input as FernRepository });
        });

    const deleteRepository = os
        .route({ method: "DELETE", path: "/repository/{repositoryOwner}/{repositoryName}/delete" })
        .input(z.custom<z.infer<typeof DeleteRepositoryInputSchema>>())
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
        .input(z.custom<z.infer<typeof GetPullRequestInputSchema>>())
        .output(z.custom<z.infer<typeof PullRequestSchema>>())
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
        .input(z.custom<z.infer<typeof ListPullRequestsInputSchema>>())
        .output(z.custom<z.infer<typeof ListPullRequestsResponseSchema>>())
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
        .input(z.custom<z.infer<typeof PullRequestSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await checkIsFernUser(authorization);
            await app.dao.git().upsertPullRequest({ pullRequest: input as PullRequest });
        });

    const deletePullRequest = os
        .route({
            method: "DELETE",
            path: "/pull-request/{repositoryOwner}/{repositoryName}/{pullRequestNumber}/delete"
        })
        .input(z.custom<z.infer<typeof DeletePullRequestInputSchema>>())
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
