import { expect, test } from "@playwright/test";

/**
 * Tests the FDR metadata-for-url endpoint for various domains and basepaths.
 *
 * Verifies that the registry returns correct metadata including org ownership.
 *
 * NOTE: This endpoint does NOT validate basepaths. It only resolves the domain
 * to an org. Any basepath (including nonexistent ones) will be echoed back in
 * the response URL without validation. FDR has no awareness of which basepaths
 * actually exist for a domain.
 */

const FDR_BASE_URL = "https://registry-dev2.buildwithfern.com";

interface MetadataResponse {
    isPreviewUrl: boolean;
    org: string;
    url: string;
    enableAlgoliaOnPreview: boolean;
    basepaths?: string[];
    [key: string]: unknown;
}

async function getMetadataForUrl(url: string): Promise<MetadataResponse> {
    const response = await fetch(`${FDR_BASE_URL}/v2/registry/docs/metadata-for-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`metadata-for-url failed (${response.status}): ${text}`);
    }

    return (await response.json()) as MetadataResponse;
}

test.describe("docs metadata-for-url", () => {
    test("fruits domain returns correct org", async () => {
        const metadata = await getMetadataForUrl("fruits.docs.dev.buildwithfern.com");
        console.log("fruits metadata:", JSON.stringify(metadata, null, 2));
        expect(metadata.org).toBe("smoke-test");
        expect(metadata.isPreviewUrl).toBe(false);
    });

    test("fruits domain with /apple basepath", async () => {
        const metadata = await getMetadataForUrl("fruits.docs.dev.buildwithfern.com/apple");
        console.log("fruits/apple metadata:", JSON.stringify(metadata, null, 2));
        expect(metadata.org).toBe("smoke-test");
    });

    test("fruits domain with /banana basepath", async () => {
        const metadata = await getMetadataForUrl("fruits.docs.dev.buildwithfern.com/banana");
        console.log("fruits/banana metadata:", JSON.stringify(metadata, null, 2));
        expect(metadata.org).toBe("smoke-test");
    });

    test("fruits domain with /apple/cosmic-crisp basepath", async () => {
        const metadata = await getMetadataForUrl("fruits.docs.dev.buildwithfern.com/apple/cosmic-crisp");
        console.log("fruits/apple/cosmic-crisp metadata:", JSON.stringify(metadata, null, 2));
        expect(metadata.org).toBe("smoke-test");
    });

    test("multi-repo-domain returns correct org", async () => {
        const metadata = await getMetadataForUrl("multi-repo-domain.docs.dev.buildwithfern.com");
        console.log("multi-repo-domain metadata:", JSON.stringify(metadata, null, 2));
        expect(metadata.org).toBeTruthy();
        expect(metadata.isPreviewUrl).toBe(false);
    });

    test("smoke-test-dev domain returns correct org", async () => {
        const metadata = await getMetadataForUrl("smoke-test-dev.docs.dev.buildwithfern.com");
        console.log("smoke-test-dev metadata:", JSON.stringify(metadata, null, 2));
        expect(metadata.org).toBe("smoke-test");
    });

    test("nonexistent basepath still resolves to org (no basepath validation)", async () => {
        const metadata = await getMetadataForUrl("fruits.docs.dev.buildwithfern.com/randomnonexistent");
        console.log("nonexistent basepath metadata:", JSON.stringify(metadata, null, 2));
        // The endpoint does not validate basepaths — it just resolves the domain
        expect(metadata.org).toBe("smoke-test");
        expect(metadata.url).toBe("fruits.docs.dev.buildwithfern.com/randomnonexistent");
    });
});
