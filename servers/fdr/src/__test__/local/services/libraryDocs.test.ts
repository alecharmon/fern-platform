import { DocsV1Write, FdrAPI } from "@fern-api/fdr-sdk";
import { uniqueId } from "es-toolkit/compat";
import { expect, inject } from "vitest";

import { getAPIResponse, getClient } from "../util";

const FONT_FILE_ID = DocsV1Write.FileId(uniqueId());

/**
 * Create a minimal DocsDefinition with a proper config.root navigation structure
 * for testing library docs merging.
 */
function createDocsDefinitionWithNavigation(): DocsV1Write.DocsDefinition {
    return {
        pages: {},
        config: {
            navigation: {
                items: [],
                landingPage: undefined
            },
            root: {
                type: "root",
                version: "v1",
                id: "test-root-id" as FdrAPI.navigation.v1.NodeId,
                title: "Test Docs",
                slug: "" as FdrAPI.navigation.v1.Slug,
                child: {
                    type: "unversioned",
                    id: "test-unversioned-id" as FdrAPI.navigation.v1.NodeId,
                    child: {
                        type: "sidebarRoot",
                        id: "test-sidebar-id" as FdrAPI.navigation.v1.NodeId,
                        children: []
                    },
                    landingPage: undefined
                },
                roles: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                featureFlags: undefined,
                pointsTo: undefined
            },
            typography: {
                headingsFont: {
                    name: "Syne",
                    fontFile: FONT_FILE_ID
                },
                bodyFont: undefined,
                codeFont: undefined
            },
            title: undefined,
            defaultLanguage: undefined,
            announcement: undefined,
            navbarLinks: undefined,
            footerLinks: undefined,
            hideNavLinks: undefined,
            logoHeight: undefined,
            logoHref: undefined,
            favicon: undefined,
            metadata: undefined,
            redirects: undefined,
            colorsV3: undefined,
            layout: undefined,
            typographyV2: undefined,
            analyticsConfig: undefined,
            integrations: undefined,
            css: undefined,
            js: undefined,
            aiChatConfig: undefined,
            backgroundImage: undefined,
            logoV2: undefined,
            logo: undefined,
            colors: undefined,
            colorsV2: undefined
        },
        jsFiles: undefined
    };
}

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

describe("library docs registration integration", () => {
    it("merges library docs into docs definition during finishDocsRegister", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });
        const domain = `libdocs-merge-${Math.random()}.docs.buildwithfern.com`;

        // Step 1: Generate library docs
        const startLibraryDocsResponse = getAPIResponse(
            await fdr.docs.v2.write.startLibraryDocsGeneration({
                orgId: FdrAPI.OrgId("acme"),
                githubUrl: FdrAPI.Url("https://github.com/fern-api/fern"),
                language: "PYTHON"
            })
        );

        // Verify generation completed
        const statusResponse = getAPIResponse(
            await fdr.docs.v2.write.getLibraryDocsGenerationStatus(startLibraryDocsResponse.jobId)
        );
        expect(statusResponse.status).toEqual("COMPLETED");

        // Step 2: Register docs with library docs config
        const startDocsRegisterResponse = getAPIResponse(
            await fdr.docs.v2.write.startDocsRegister({
                orgId: FdrAPI.OrgId("acme"),
                apiId: FdrAPI.ApiId("api"),
                domain: `https://${domain}`,
                customDomains: [],
                filepaths: [DocsV1Write.FilePath("fonts/Syne.woff2")]
            })
        );

        // Step 3: Finish registration with library docs job
        await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
            docsDefinition: createDocsDefinitionWithNavigation(),
            libraryDocs: {
                jobId: startLibraryDocsResponse.jobId,
                slug: "sdk-reference",
                title: "SDK Reference"
            }
        });

        // Step 4: Verify merged docs
        const docs = getAPIResponse(
            await fdr.docs.v2.read.getDocsForUrl({
                url: FdrAPI.Url(`https://${domain}`)
            })
        );

        // Verify pages were merged - should have library docs pages
        const pageIds = Object.keys(docs.definition.pages);
        expect(pageIds.length).toBeGreaterThan(0);

        // At least one page should have library docs slug prefix
        const libraryDocsPages = pageIds.filter((id) => id.includes("sdk-reference"));
        expect(libraryDocsPages.length).toBeGreaterThan(0);

        // Verify navigation was merged - check sidebar has library docs section
        const root = docs.definition.config.root;
        expect(root).toBeDefined();
        if (root != null && root.child.type === "unversioned") {
            const sidebarRoot = root.child.child;
            if (sidebarRoot.type === "sidebarRoot") {
                // Should have at least one child (the library docs section)
                expect(sidebarRoot.children.length).toBeGreaterThan(0);

                // Find library docs section
                const librarySection = sidebarRoot.children.find(
                    (child) => child.type === "section" && child.title === "SDK Reference"
                );
                expect(librarySection).toBeDefined();
            }
        }
    });

    it("returns error when library docs job does not exist", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });
        const domain = `libdocs-notfound-${Math.random()}.docs.buildwithfern.com`;

        // Start docs registration
        const startDocsRegisterResponse = getAPIResponse(
            await fdr.docs.v2.write.startDocsRegister({
                orgId: FdrAPI.OrgId("acme"),
                apiId: FdrAPI.ApiId("api"),
                domain: `https://${domain}`,
                customDomains: [],
                filepaths: [DocsV1Write.FilePath("fonts/Syne.woff2")]
            })
        );

        // Try to finish with non-existent job ID
        const finishResponse = await fdr.docs.v2.write.finishDocsRegister(
            startDocsRegisterResponse.docsRegistrationId,
            {
                docsDefinition: createDocsDefinitionWithNavigation(),
                libraryDocs: {
                    jobId: FdrAPI.docs.v2.write.LibraryDocsJobId("libdocs_nonexistent-job-id")
                }
            }
        );

        expect(finishResponse.ok).toBe(false);
        if (!finishResponse.ok) {
            expect(finishResponse.error.error).toEqual("LibraryDocsJobInvalidForRegistrationError");
        }
    });

    it("returns error when library docs job belongs to different org", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });
        const domain = `libdocs-wrongorg-${Math.random()}.docs.buildwithfern.com`;

        // Generate library docs for "acme" org
        const startLibraryDocsResponse = getAPIResponse(
            await fdr.docs.v2.write.startLibraryDocsGeneration({
                orgId: FdrAPI.OrgId("acme"),
                githubUrl: FdrAPI.Url("https://github.com/fern-api/fern"),
                language: "PYTHON"
            })
        );

        // Verify generation completed
        const statusResponse = getAPIResponse(
            await fdr.docs.v2.write.getLibraryDocsGenerationStatus(startLibraryDocsResponse.jobId)
        );
        expect(statusResponse.status).toEqual("COMPLETED");

        // Start docs registration for different org "fern"
        const startDocsRegisterResponse = getAPIResponse(
            await fdr.docs.v2.write.startDocsRegister({
                orgId: FdrAPI.OrgId("fern"),
                apiId: FdrAPI.ApiId("api"),
                domain: `https://${domain}`,
                customDomains: [],
                filepaths: [DocsV1Write.FilePath("fonts/Syne.woff2")]
            })
        );

        // Try to finish with job from different org
        const finishResponse = await fdr.docs.v2.write.finishDocsRegister(
            startDocsRegisterResponse.docsRegistrationId,
            {
                docsDefinition: createDocsDefinitionWithNavigation(),
                libraryDocs: {
                    jobId: startLibraryDocsResponse.jobId
                }
            }
        );

        expect(finishResponse.ok).toBe(false);
        if (!finishResponse.ok) {
            expect(finishResponse.error.error).toEqual("LibraryDocsJobInvalidForRegistrationError");
        }
    });

    it("uses default slug and title when not provided", async () => {
        const fdr = getClient({ authed: true, url: inject("url") });
        const domain = `libdocs-defaults-${Math.random()}.docs.buildwithfern.com`;

        // Generate library docs
        const startLibraryDocsResponse = getAPIResponse(
            await fdr.docs.v2.write.startLibraryDocsGeneration({
                orgId: FdrAPI.OrgId("acme"),
                githubUrl: FdrAPI.Url("https://github.com/fern-api/fern"),
                language: "PYTHON"
            })
        );

        // Verify generation completed
        const statusResponse = getAPIResponse(
            await fdr.docs.v2.write.getLibraryDocsGenerationStatus(startLibraryDocsResponse.jobId)
        );
        expect(statusResponse.status).toEqual("COMPLETED");

        // Register docs without providing slug/title
        const startDocsRegisterResponse = getAPIResponse(
            await fdr.docs.v2.write.startDocsRegister({
                orgId: FdrAPI.OrgId("acme"),
                apiId: FdrAPI.ApiId("api"),
                domain: `https://${domain}`,
                customDomains: [],
                filepaths: [DocsV1Write.FilePath("fonts/Syne.woff2")]
            })
        );

        await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
            docsDefinition: createDocsDefinitionWithNavigation(),
            libraryDocs: {
                jobId: startLibraryDocsResponse.jobId
                // No slug or title provided - should use defaults
            }
        });

        // Verify defaults were used
        const docs = getAPIResponse(
            await fdr.docs.v2.read.getDocsForUrl({
                url: FdrAPI.Url(`https://${domain}`)
            })
        );

        // Check for default slug "library-docs" in page IDs
        const pageIds = Object.keys(docs.definition.pages);
        const libraryDocsPages = pageIds.filter((id) => id.includes("library-docs"));
        expect(libraryDocsPages.length).toBeGreaterThan(0);

        // Check navigation section has default title "Library Reference"
        const root = docs.definition.config.root;
        expect(root).toBeDefined();
        if (root != null && root.child.type === "unversioned") {
            const sidebarRoot = root.child.child;
            if (sidebarRoot.type === "sidebarRoot") {
                const librarySection = sidebarRoot.children.find(
                    (child) => child.type === "section" && child.title === "Library Reference"
                );
                expect(librarySection).toBeDefined();
            }
        }
    });
});
