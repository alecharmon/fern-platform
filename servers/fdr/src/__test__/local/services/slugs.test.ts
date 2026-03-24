import { DocsV1Write, FdrAPI } from "@fern-api/fdr-sdk";
import { createSlugsClient } from "@fern-api/fdr-sdk/orpc-client";
import { uniqueId } from "es-toolkit/compat";
import { expect, inject } from "vitest";

import { getClient } from "../util";

const FONT_FILE_ID = DocsV1Write.FileId(uniqueId());

function createDocsDefinitionWithPages(pages: Record<string, { markdown: string }>): DocsV1Write.DocsDefinition {
    return {
        pages,
        config: {
            navigation: { items: [], landingPage: undefined },
            root: undefined,
            typography: {
                headingsFont: { name: "Syne", fontFile: FONT_FILE_ID },
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

it("slug and markdown page entries are created after docs publish", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });
    const domain = `slug-table-${Math.random()}.docs.buildwithfern.com`;

    const startResponse = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });

    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: startResponse.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "pages/intro.mdx": { markdown: "# Introduction\n\nWelcome to the docs." },
            "pages/guide.mdx": { markdown: "# Guide\n\nThis is a guide." }
        })
    });

    const client = createSlugsClient({ baseUrl: inject("url"), token: "dummy" });

    // Slug endpoint: two pages with no nav tree both map to slug "", so one slug entry
    const slugResponse = await client.getSlugEntries({ domain });
    expect(slugResponse.entries).toHaveLength(1);
    expect(slugResponse.entries[0]!.orgId).toBe("acme");
    expect(slugResponse.entries[0]!.domain).toBe(domain);
    expect(slugResponse.entries[0]!.slug).toBe("");
    expect(slugResponse.entries[0]!.lastUpdated).toBeTruthy();

    // Markdown pages endpoint: one entry per file
    const pageResponse = await client.getMarkdownEntries({ domain });
    expect(pageResponse.entries).toHaveLength(2);
    const pageIds = pageResponse.entries.map((e) => e.pageId).sort();
    expect(pageIds).toEqual(["pages/guide.mdx", "pages/intro.mdx"]);
    for (const entry of pageResponse.entries) {
        expect(entry.orgId).toBe("acme");
        expect(entry.domain).toBe(domain);
        expect(entry.hash).toBeTruthy();
        expect(entry.lastUpdated).toBeTruthy();
    }
});

it("slug lastUpdated reflects the latest markdown page change", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });
    const domain = `slug-update-${Math.random()}.docs.buildwithfern.com`;
    const client = createSlugsClient({ baseUrl: inject("url"), token: "dummy" });

    const start1 = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });
    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: start1.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "pages/intro.mdx": { markdown: "# Intro\n\nOriginal content." }
        })
    });

    const slugResponse1 = await client.getSlugEntries({ domain });
    const pageResponse1 = await client.getMarkdownEntries({ domain });
    const originalHash = pageResponse1.entries[0]!.hash;
    const originalSlugUpdated = slugResponse1.entries[0]!.lastUpdated;

    await new Promise((resolve) => setTimeout(resolve, 50));

    const start2 = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });
    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: start2.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "pages/intro.mdx": { markdown: "# Intro\n\nUpdated content!" }
        })
    });

    const slugResponse2 = await client.getSlugEntries({ domain });
    const pageResponse2 = await client.getMarkdownEntries({ domain });

    // Hash changed on the markdown page
    expect(pageResponse2.entries[0]!.hash).not.toBe(originalHash);
    // Slug lastUpdated reflects the markdown page update
    expect(slugResponse2.entries[0]!.lastUpdated).not.toBe(originalSlugUpdated);
});

it("markdown page entries are not updated for whitespace-only changes", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });
    const domain = `slug-whitespace-${Math.random()}.docs.buildwithfern.com`;
    const client = createSlugsClient({ baseUrl: inject("url"), token: "dummy" });

    const start1 = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });
    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: start1.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "pages/intro.mdx": { markdown: "# Hello\n\nWorld" }
        })
    });

    const originalHash = (await client.getMarkdownEntries({ domain })).entries[0]!.hash;

    const start2 = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });
    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: start2.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "pages/intro.mdx": { markdown: "  # Hello \n\n World  " }
        })
    });

    const hash2 = (await client.getMarkdownEntries({ domain })).entries[0]!.hash;
    expect(hash2).toBe(originalHash);
});

it("removes markdown pages and orphaned slugs for deleted pages", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });
    const domain = `slug-delete-${Math.random()}.docs.buildwithfern.com`;
    const client = createSlugsClient({ baseUrl: inject("url"), token: "dummy" });

    const start1 = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });
    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: start1.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "pages/intro.mdx": { markdown: "# Intro" },
            "pages/guide.mdx": { markdown: "# Guide" }
        })
    });

    expect((await client.getMarkdownEntries({ domain })).entries).toHaveLength(2);

    const start2 = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });
    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: start2.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "pages/intro.mdx": { markdown: "# Intro" }
        })
    });

    const pageResponse = await client.getMarkdownEntries({ domain });
    expect(pageResponse.entries).toHaveLength(1);
    expect(pageResponse.entries[0]!.pageId).toBe("pages/intro.mdx");
});

it("returns empty entries for unknown domain", async () => {
    const client = createSlugsClient({ baseUrl: inject("url"), token: "dummy" });
    const domain = "nonexistent.example.com";
    expect((await client.getSlugEntries({ domain })).entries).toHaveLength(0);
    expect((await client.getMarkdownEntries({ domain })).entries).toHaveLength(0);
});

it("multiple markdown pages share a slug (changelog pattern)", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });
    const domain = `slug-multi-${Math.random()}.docs.buildwithfern.com`;

    const startResponse = await fdr.docs.v2.write.startDocsRegister({
        orgId: FdrAPI.OrgId("acme"),
        apiId: FdrAPI.ApiId(""),
        domain: `https://${domain}`,
        customDomains: [],
        filepaths: [DocsV1Write.FilePath("logo.png")]
    });
    await fdr.docs.v2.write.finishDocsRegister({
        docsRegistrationId: startResponse.docsRegistrationId,
        docsDefinition: createDocsDefinitionWithPages({
            "changelog/2024-01-01.mdx": { markdown: "# 2024-01-01\n\nFirst entry." },
            "changelog/2024-02-01.mdx": { markdown: "# 2024-02-01\n\nSecond entry." }
        })
    });

    const client = createSlugsClient({ baseUrl: inject("url"), token: "dummy" });

    // Both pages share slug "" (no nav tree) → one slug entry, two markdown page entries
    const slugResponse = await client.getSlugEntries({ domain });
    expect(slugResponse.entries).toHaveLength(1);
    expect(slugResponse.entries[0]!.slug).toBe("");

    const pageResponse = await client.getMarkdownEntries({ domain });
    expect(pageResponse.entries).toHaveLength(2);
    const pageIds = pageResponse.entries.map((e) => e.pageId).sort();
    expect(pageIds).toEqual(["changelog/2024-01-01.mdx", "changelog/2024-02-01.mdx"]);
    // All pages reference the same slug
    expect(new Set(pageResponse.entries.map((e) => e.slug)).size).toBe(1);
});
