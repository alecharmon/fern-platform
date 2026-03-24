import { beforeEach, describe, expect, it, vi } from "vitest";
import * as onboardingSession from "@/utils/onboardingSession";
import {
    handleWorkflowSuccess,
    linkRepoToDocsSite,
    notifyPostman,
    registerPostmanCollection
} from "../completion-handlers";

vi.mock("@/utils/onboardingSession", () => ({
    getOnboardingFormData: vi.fn(),
    getOnboardingSession: vi.fn()
}));

const mockGetOnboardingFormData = vi.mocked(onboardingSession.getOnboardingFormData);

describe("linkRepoToDocsSite", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should call link-repo endpoint with correct params", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

        await linkRepoToDocsSite("https://my-org.docs.buildwithfern.com", "https://github.com/fern-support/my-repo");

        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/link-repo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                docsUrl: "my-org.docs.buildwithfern.com",
                githubUrl: "https://github.com/fern-support/my-repo"
            })
        });
    });

    it("should not throw when response is not ok", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Not found", { status: 404 }));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(linkRepoToDocsSite("https://example.com", "https://github.com/owner/repo")).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalled();
    });

    it("should not throw when fetch fails", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(linkRepoToDocsSite("https://example.com", "https://github.com/owner/repo")).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalled();
    });
});

describe("registerPostmanCollection", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should call register-postman-collection endpoint with correct params", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

        await registerPostmanCollection("https://my-org.docs.buildwithfern.com", "my-org", "collection-123");

        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/register-postman-collection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                domain: "my-org.docs.buildwithfern.com",
                orgId: "my-org",
                postmanCollectionId: "collection-123"
            })
        });
    });

    it("should not throw when response is not ok", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Server error", { status: 500 }));
        vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(registerPostmanCollection("https://example.com", "org", "col-123")).resolves.not.toThrow();
    });
});

describe("notifyPostman", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should call postman-notify endpoint with correct params", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

        await notifyPostman("https://my-org.docs.buildwithfern.com", "team-456", "collection-123");

        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/postman-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                teamId: "team-456",
                collectionId: "collection-123",
                siteUrl: "my-org.docs.buildwithfern.com",
                generationStatus: "SUCCESS"
            })
        });
    });

    it("should not throw when fetch fails", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
        vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(notifyPostman("https://example.com", "team-1", "col-1")).resolves.not.toThrow();
    });
});

describe("handleWorkflowSuccess", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockGetOnboardingFormData.mockReturnValue(null);
    });

    it("should call linkRepoToDocsSite when hasLinkedRepo is false", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

        await handleWorkflowSuccess(
            "https://my-org.docs.buildwithfern.com",
            "my-org",
            "https://github.com/fern-support/my-repo",
            false
        );

        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/link-repo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                docsUrl: "my-org.docs.buildwithfern.com",
                githubUrl: "https://github.com/fern-support/my-repo"
            })
        });
    });

    it("should skip linkRepoToDocsSite when hasLinkedRepo is true", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

        await handleWorkflowSuccess(
            "https://my-org.docs.buildwithfern.com",
            "my-org",
            "https://github.com/fern-support/my-repo",
            true
        );

        expect(globalThis.fetch).not.toHaveBeenCalledWith("/api/onboarding-docs/link-repo", expect.anything());
    });

    it("should register postman collection when form data has postmanCollectionId", async () => {
        mockGetOnboardingFormData.mockReturnValue({
            postmanCollectionId: "col-123",
            postmanTeamId: null,
            docsSiteName: "",
            docsSiteUrl: "",
            primaryColorHex: "",
            openApiSpecUrls: [],
            logoFile: null,
            logoUrl: null,
            logoFileName: null,
            faviconFile: null,
            faviconUrl: null,
            faviconFileName: null
        });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

        await handleWorkflowSuccess(
            "https://my-org.docs.buildwithfern.com",
            "my-org",
            "https://github.com/fern-support/my-repo",
            false
        );

        // Should call link-repo AND register-postman-collection
        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/link-repo", expect.anything());
        expect(globalThis.fetch).toHaveBeenCalledWith(
            "/api/onboarding-docs/register-postman-collection",
            expect.anything()
        );
    });

    it("should not throw even when linking fails", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
        vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(
            handleWorkflowSuccess(
                "https://my-org.docs.buildwithfern.com",
                "my-org",
                "https://github.com/fern-support/my-repo",
                false
            )
        ).resolves.not.toThrow();
    });
});
