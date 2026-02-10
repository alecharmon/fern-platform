import { describe, expect, it } from "vitest";
import { getDocsSitesUsage } from "../usage/docs-sites";
import { createUsageProvider } from "../usage/provider";
import { getSeatsUsage } from "../usage/seats";

describe("createUsageProvider", () => {
    it("routes seats to getSeatsUsage", async () => {
        const provider = createUsageProvider();
        await expect(provider.getCurrentUsage("org-1", "seats")).rejects.toThrow("getSeatsUsage not implemented");
    });

    it("routes docs_sites to getDocsSitesUsage", async () => {
        const provider = createUsageProvider();
        await expect(provider.getCurrentUsage("org-1", "docs_sites")).rejects.toThrow(
            "getDocsSitesUsage not implemented"
        );
    });
});

describe("getSeatsUsage", () => {
    it("throws not implemented", async () => {
        await expect(getSeatsUsage("org-1")).rejects.toThrow("not implemented");
    });
});

describe("getDocsSitesUsage", () => {
    it("throws not implemented", async () => {
        await expect(getDocsSitesUsage("org-1")).rejects.toThrow("not implemented");
    });
});
