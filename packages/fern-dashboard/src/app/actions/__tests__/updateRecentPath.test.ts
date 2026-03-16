import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Auth0UserID } from "@/app/services/auth0/types";

const { getCurrentSession } = vi.hoisted(() => ({
    getCurrentSession: vi.fn()
}));

const { setRecentPath } = vi.hoisted(() => ({
    setRecentPath: vi.fn()
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession
}));

vi.mock("@/app/services/auth0/recentPath", () => ({
    setRecentPath
}));

import { updateRecentPath } from "../updateRecentPath";

describe("updateRecentPath", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentSession.mockResolvedValue({
            user: { sub: "user_123" as Auth0UserID },
            accessToken: "token"
        });
    });

    describe("allowlist", () => {
        it.each(["docs", "billing", "members", "ai-usage", "settings"])(
            "tracks paths with /%s segment",
            async (segment) => {
                await updateRecentPath(`/acme/${segment}/some-page`);

                expect(setRecentPath).toHaveBeenCalledWith("user_123", `/acme/${segment}/some-page`);
            }
        );

        it.each(["/acme/login", "/acme/onboarding", "/acme/", "/acme", "/", ""])(
            "does not track non-allowlisted path: %s",
            async (path) => {
                await updateRecentPath(path);

                expect(setRecentPath).not.toHaveBeenCalled();
            }
        );
    });

    it("does not track when session is missing", async () => {
        getCurrentSession.mockResolvedValue(undefined);

        await updateRecentPath("/acme/docs/page");

        expect(setRecentPath).not.toHaveBeenCalled();
    });
});
