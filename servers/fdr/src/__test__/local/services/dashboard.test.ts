import { FdrAPI } from "@fern-api/fdr-sdk";
import { createDashboardClient } from "@fern-api/fdr-sdk/orpc-client";
import { inject } from "vitest";

import { prisma } from "../setupMockFdr";
import { getAPIResponse, getClient } from "../util";
import { WRITE_DOCS_REGISTER_DEFINITION } from "./docs.test";

it("get my docs sties", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    const startDocsRegisterResponse = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("dashboard-org"),
            apiId: FdrAPI.ApiId("api-1"),
            domain: "https://dashboard-org.docs.buildwithfern.com",
            customDomains: ["www.dashboard-org.com", "www.dashboard-org.com/docs"],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    const startDocsRegisterResponse2 = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("dashboard-org"),
            apiId: FdrAPI.ApiId("api-2"),
            domain: "https://dashboard-org-2.docs.buildwithfern.com",
            customDomains: ["www.dashboard-org-2.com", "www.dashboard-org-2.com/docs"],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse2.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    const dashboardClient = createDashboardClient({
        baseUrl: inject("url"),
        token: "dummy"
    });
    const docsSites = await dashboardClient.getDocsSitesForOrg({
        orgId: "dashboard-org"
    });

    expect(docsSites).toEqual({
        docsSites: [
            {
                mainUrl: {
                    domain: "www.dashboard-org-2.com",
                    path: ""
                },
                urls: [
                    {
                        domain: "www.dashboard-org-2.com",
                        path: ""
                    },
                    {
                        domain: "www.dashboard-org-2.com",
                        path: "/docs"
                    },
                    {
                        domain: "dashboard-org-2.docs.buildwithfern.com",
                        path: ""
                    }
                ],
                status: "LIVE"
            },
            {
                mainUrl: {
                    domain: "www.dashboard-org.com",
                    path: ""
                },
                urls: [
                    {
                        domain: "www.dashboard-org.com",
                        path: ""
                    },
                    {
                        domain: "www.dashboard-org.com",
                        path: "/docs"
                    },
                    {
                        domain: "dashboard-org.docs.buildwithfern.com",
                        path: ""
                    }
                ],
                status: "LIVE"
            }
        ]
    });
});

it("docs sites without DocsSite records still appear via DocsV2 fallback", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    // Register a docs site via the DocsV2 write API only (no DocsSite record)
    const startDocsRegisterResponse = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("acme"),
            apiId: FdrAPI.ApiId("fallback-api"),
            domain: "https://acme-fallback.docs.buildwithfern.com",
            customDomains: ["www.acme-fallback.com"],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    const dashboardClient = createDashboardClient({
        baseUrl: inject("url"),
        token: "dummy"
    });

    const docsSites = await dashboardClient.getDocsSitesForOrg({
        orgId: "acme"
    });

    // The site should appear with status "LIVE" from the DocsV2 fallback
    const fallbackSite = docsSites.docsSites.find((site) =>
        site.urls.some((url) => url.domain === "acme-fallback.docs.buildwithfern.com")
    );
    expect(fallbackSite).toBeDefined();
    expect(fallbackSite!.status).toBe("LIVE");
    expect(fallbackSite!.mainUrl.domain).toBe("www.acme-fallback.com");
});

it("DocsSite records with PUBLISHING status show as publishing", async () => {
    const dashboardClient = createDashboardClient({
        baseUrl: inject("url"),
        token: "dummy"
    });

    // Insert a DocsSite record directly with PUBLISHING status (simulates an in-flight deployment)
    await prisma.docsSite.create({
        data: {
            id: "docs_site_publishing_test",
            orgId: "acme",
            domain: "acme-publishing.docs.buildwithfern.com",
            basepath: "",
            status: "PUBLISHING"
        }
    });

    const docsSites = await dashboardClient.getDocsSitesForOrg({
        orgId: "acme"
    });

    const publishingSite = docsSites.docsSites.find(
        (site) => site.mainUrl.domain === "acme-publishing.docs.buildwithfern.com"
    );
    expect(publishingSite).toBeDefined();
    expect(publishingSite!.status).toBe("PUBLISHING");
});

it("DocsV2 sites are not duplicated when a matching DocsSite record exists", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    // Register a docs site via DocsV2 write API
    const startDocsRegisterResponse = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("acme"),
            apiId: FdrAPI.ApiId("dedup-api"),
            domain: "https://acme-dedup.docs.buildwithfern.com",
            customDomains: [],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    // Also create a matching DocsSite record for the same domain (simulates the new deployment flow)
    await prisma.docsSite.create({
        data: {
            id: "docs_site_dedup_test",
            orgId: "acme",
            domain: "acme-dedup.docs.buildwithfern.com",
            basepath: "",
            status: "LIVE"
        }
    });

    const dashboardClient = createDashboardClient({
        baseUrl: inject("url"),
        token: "dummy"
    });
    const docsSites = await dashboardClient.getDocsSitesForOrg({
        orgId: "acme"
    });

    // The domain should appear only once (from DocsSite, not duplicated from DocsV2)
    const matchingSites = docsSites.docsSites.filter(
        (site) =>
            site.mainUrl.domain === "acme-dedup.docs.buildwithfern.com" ||
            site.urls.some((url) => url.domain === "acme-dedup.docs.buildwithfern.com")
    );
    expect(matchingSites).toHaveLength(1);
    expect(matchingSites[0]!.status).toBe("LIVE");
});

it("DocsSite records are enriched with custom domain URLs from DocsV2", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    // Register a docs site via DocsV2 write API with a custom domain
    const startDocsRegisterResponse = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("enriched-org"),
            apiId: FdrAPI.ApiId("enriched-api"),
            domain: "https://enriched-org.docs.buildwithfern.com",
            customDomains: ["docs.enriched.com"],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    // Create a matching DocsSite record (simulates the deployment flow storing only the fern domain)
    await prisma.docsSite.create({
        data: {
            id: "docs_site_enriched_test",
            orgId: "enriched-org",
            domain: "enriched-org.docs.buildwithfern.com",
            basepath: "",
            status: "LIVE"
        }
    });

    const dashboardClient = createDashboardClient({
        baseUrl: inject("url"),
        token: "dummy"
    });
    const docsSites = await dashboardClient.getDocsSitesForOrg({
        orgId: "enriched-org"
    });

    // Should only have one site (not duplicated)
    expect(docsSites.docsSites).toHaveLength(1);
    const site = docsSites.docsSites[0]!;

    // The mainUrl should use the custom domain (not the fern domain)
    expect(site.mainUrl.domain).toBe("docs.enriched.com");

    // The urls array should include both the custom domain and fern domain
    const domains = site.urls.map((url) => url.domain);
    expect(domains).toContain("docs.enriched.com");
    expect(domains).toContain("enriched-org.docs.buildwithfern.com");

    // Status should come from the DocsSite record
    expect(site.status).toBe("LIVE");
});

it("mixed scenario: DocsSite publishing + DocsV2-only sites both appear correctly", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    // Create a DocsV2-only site (no DocsSite record) — should appear as "live"
    const startDocsRegisterResponse = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("octoai"),
            apiId: FdrAPI.ApiId("mixed-legacy-api"),
            domain: "https://octoai-legacy.docs.buildwithfern.com",
            customDomains: ["www.octoai-legacy.com"],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    // Create a DocsSite-only record with PUBLISHING status (no DocsV2 entry) — should appear as "publishing"
    await prisma.docsSite.create({
        data: {
            id: "docs_site_mixed_publishing",
            orgId: "octoai",
            domain: "octoai-new.docs.buildwithfern.com",
            basepath: "",
            status: "PUBLISHING"
        }
    });

    const dashboardClient = createDashboardClient({
        baseUrl: inject("url"),
        token: "dummy"
    });
    const docsSites = await dashboardClient.getDocsSitesForOrg({
        orgId: "octoai"
    });

    // The legacy DocsV2-only site should appear with "live" status
    const legacySite = docsSites.docsSites.find((site) =>
        site.urls.some((url) => url.domain === "octoai-legacy.docs.buildwithfern.com")
    );
    expect(legacySite).toBeDefined();
    expect(legacySite!.status).toBe("LIVE");

    // The new publishing-only site should appear with "publishing" status
    const publishingSite = docsSites.docsSites.find(
        (site) => site.mainUrl.domain === "octoai-new.docs.buildwithfern.com"
    );
    expect(publishingSite).toBeDefined();
    expect(publishingSite!.status).toBe("PUBLISHING");
});
