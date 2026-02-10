import { describe, expect, it, vi } from "vitest";
import { getDocsSitesUsage } from "../usage/docs-sites";
import { createUsageProvider } from "../usage/provider";
import { getSeatsUsage } from "../usage/seats";

vi.mock("../usage/auth0", () => ({
    getAuth0ManagementClient: vi.fn()
}));

import { getAuth0ManagementClient } from "../usage/auth0";

const mockGetAuth0ManagementClient = vi.mocked(getAuth0ManagementClient);

function mockGetMembers(pages: Array<Array<{ user_id: string; email: string }>>) {
    let callCount = 0;
    const mockClient = {
        organizations: {
            getMembers: vi.fn().mockImplementation(() => {
                const data = pages[callCount] ?? [];
                callCount++;
                return Promise.resolve({ data });
            })
        }
    };
    mockGetAuth0ManagementClient.mockReturnValue(mockClient as any);
    return mockClient;
}

describe("createUsageProvider", () => {
    it("routes seats to getSeatsUsage", async () => {
        mockGetMembers([[{ user_id: "u1", email: "alice@example.com" }]]);
        const provider = createUsageProvider();
        const usage = await provider.getCurrentUsage("org_123", "seats");
        expect(usage).toBe(1);
    });

    it("routes docs_sites to getDocsSitesUsage", async () => {
        const provider = createUsageProvider();
        await expect(provider.getCurrentUsage("org-1", "docs_sites")).rejects.toThrow(
            "getDocsSitesUsage not implemented"
        );
    });
});

describe("getSeatsUsage", () => {
    it("returns correct count excluding @buildwithfern.com members", async () => {
        mockGetMembers([
            [
                { user_id: "u1", email: "alice@example.com" },
                { user_id: "u2", email: "bob@buildwithfern.com" },
                { user_id: "u3", email: "carol@acme.co" }
            ]
        ]);

        const count = await getSeatsUsage("org_123");
        expect(count).toBe(2);
    });

    it("handles pagination across multiple pages", async () => {
        // page size is 100, so we simulate two pages
        const page1 = Array.from({ length: 100 }, (_, i) => ({
            user_id: `u${i}`,
            email: `user${i}@example.com`
        }));
        const page2 = [
            { user_id: "u100", email: "user100@example.com" },
            { user_id: "u101", email: "fern@buildwithfern.com" }
        ];

        const mockClient = mockGetMembers([page1, page2]);

        const count = await getSeatsUsage("org_456");
        expect(count).toBe(101); // 100 from page1 + 1 non-fern from page2
        expect(mockClient.organizations.getMembers).toHaveBeenCalledTimes(2);
    });

    it("returns 0 for an org with only @buildwithfern.com members", async () => {
        mockGetMembers([
            [
                { user_id: "u1", email: "alice@buildwithfern.com" },
                { user_id: "u2", email: "bob@buildwithfern.com" }
            ]
        ]);

        const count = await getSeatsUsage("org_789");
        expect(count).toBe(0);
    });

    it("returns 0 for an empty org", async () => {
        mockGetMembers([[]]);

        const count = await getSeatsUsage("org_empty");
        expect(count).toBe(0);
    });
});

describe("getDocsSitesUsage", () => {
    it("throws not implemented", async () => {
        await expect(getDocsSitesUsage("org-1")).rejects.toThrow("not implemented");
    });
});
