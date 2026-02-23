import { createGitClient } from "@fern-api/fdr-sdk/orpc-client";
import { inject } from "vitest";

it("register repo", async () => {
    const git = createGitClient({ baseUrl: inject("url"), token: "dummy" });
    await git.upsertRepository({
        type: "config",
        id: {
            type: "github",
            id: "test"
        },
        name: "name",
        owner: "owner",
        fullName: "repository.full_name",
        url: "repository.html_url",
        repositoryOwnerOrganizationId: "organizationId",
        defaultBranchChecks: []
    });

    const registeredRepo = await git.getRepository({ repositoryOwner: "owner", repositoryName: "name" });

    expect(registeredRepo.id).toEqual({
        type: "github",
        id: "test"
    });
});
