import { FdrAPI } from "@fern-api/fdr-sdk";
import { expect, inject } from "vitest";

import { getAPIResponse, getClient } from "../util";

describe("library docs generation", () => {
    it("generates library docs for a Python repository", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });

        // Start generation
        const startResponse = getAPIResponse(
            await fdr.docs.v2.write.startLibraryDocsGeneration({
                orgId: FdrAPI.OrgId("acme"),
                githubUrl: FdrAPI.Url("https://github.com/fern-api/fern"),
                language: "PYTHON"
            })
        );

        expect(startResponse.jobId).toBeDefined();
        expect(startResponse.jobId).toMatch(/^libdocs_/);

        // Check status
        const statusResponse = getAPIResponse(
            await fdr.docs.v2.write.getLibraryDocsGenerationStatus(startResponse.jobId)
        );

        expect(statusResponse.jobId).toEqual(startResponse.jobId);
        expect(statusResponse.status).toEqual("COMPLETED");
        expect(statusResponse.createdAt).toBeDefined();
        expect(statusResponse.updatedAt).toBeDefined();

        // Get result
        const resultResponse = getAPIResponse(await fdr.docs.v2.write.getLibraryDocsResult(startResponse.jobId));

        expect(resultResponse.jobId).toEqual(startResponse.jobId);
        expect(resultResponse.resultUrl).toBeDefined();
        expect(resultResponse.resultUrl).toContain("library-docs-results");
    });

    it("generates library docs with optional config", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });

        const startResponse = getAPIResponse(
            await fdr.docs.v2.write.startLibraryDocsGeneration({
                orgId: FdrAPI.OrgId("acme"),
                githubUrl: FdrAPI.Url("https://github.com/fern-api/fern"),
                language: "PYTHON",
                config: {
                    branch: "main",
                    packagePath: "src/mypackage",
                    title: "My SDK Reference",
                    slug: "my-sdk"
                }
            })
        );

        expect(startResponse.jobId).toBeDefined();

        const statusResponse = getAPIResponse(
            await fdr.docs.v2.write.getLibraryDocsGenerationStatus(startResponse.jobId)
        );

        expect(statusResponse.status).toEqual("COMPLETED");
    });

    it("returns 404 for non-existent job ID", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });

        const statusResponse = await fdr.docs.v2.write.getLibraryDocsGenerationStatus("libdocs_non-existent-job-id");

        expect(statusResponse.ok).toBe(false);
        if (!statusResponse.ok) {
            expect(statusResponse.error.error).toEqual("LibraryDocsJobNotFoundError");
        }
    });

    it("returns error when getting result for non-existent job", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });

        const resultResponse = await fdr.docs.v2.write.getLibraryDocsResult("libdocs_non-existent-job-id");

        expect(resultResponse.ok).toBe(false);
        if (!resultResponse.ok) {
            expect(resultResponse.error.error).toEqual("LibraryDocsJobNotFoundError");
        }
    });

    it("fetches result from S3 and validates structure", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });

        // Generate docs
        const startResponse = getAPIResponse(
            await fdr.docs.v2.write.startLibraryDocsGeneration({
                orgId: FdrAPI.OrgId("acme"),
                githubUrl: FdrAPI.Url("https://github.com/example/repo"),
                language: "PYTHON"
            })
        );

        // Get result URL
        const resultResponse = getAPIResponse(await fdr.docs.v2.write.getLibraryDocsResult(startResponse.jobId));

        // Fetch from S3
        const s3Response = await fetch(resultResponse.resultUrl);
        expect(s3Response.ok).toBe(true);

        const s3Result = await s3Response.json();

        // Validate structure
        expect(s3Result.jobId).toEqual(startResponse.jobId);
        expect(s3Result.pages).toBeDefined();
        expect(typeof s3Result.pages).toBe("object");
        expect(s3Result.navigation).toBeDefined();
        expect(s3Result.navigation.title).toBeDefined();
        expect(s3Result.navigation.slug).toBeDefined();
        expect(s3Result.navigation.children).toBeDefined();
        expect(Array.isArray(s3Result.navigation.children)).toBe(true);
        expect(s3Result.metadata).toBeDefined();
        expect(s3Result.metadata.sourceUrl).toBeDefined();
        expect(s3Result.metadata.parsedAt).toBeDefined();
        expect(s3Result.metadata.parserVersion).toEqual("stub-1.0");
    });
});
