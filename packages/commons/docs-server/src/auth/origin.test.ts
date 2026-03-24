import { preferPreview } from "./origin";

// Mock the server-only directive
vi.mock("server-only", () => ({}));

vi.mock("@vercel/functions", () => ({
    getEnv: vi.fn(() => ({}))
}));

vi.mock("../isSelfHosted", () => ({
    isSelfHosted: vi.fn(() => false)
}));

import { getEnv } from "@vercel/functions";
import { isSelfHosted } from "../isSelfHosted";

describe("preferPreview", () => {
    beforeEach(() => {
        vi.mocked(isSelfHosted).mockReturnValue(false);
        vi.mocked(getEnv).mockReturnValue({} as ReturnType<typeof getEnv>);
    });

    it("should return domain in self-hosted mode even when host differs", () => {
        vi.mocked(isSelfHosted).mockReturnValue(true);

        const result = preferPreview("localhost:3001", "docs.example.com");
        expect(result).toBe("docs.example.com");
    });

    it("should return domain in self-hosted mode when host is the internal address", () => {
        vi.mocked(isSelfHosted).mockReturnValue(true);

        const result = preferPreview("localhost:3000", "hw-helen.app-staging.gov.nominal.io");
        expect(result).toBe("hw-helen.app-staging.gov.nominal.io");
    });

    it("should return domain in self-hosted mode regardless of VERCEL_ENV", () => {
        vi.mocked(isSelfHosted).mockReturnValue(true);
        vi.mocked(getEnv).mockReturnValue({ VERCEL_ENV: "production" } as ReturnType<typeof getEnv>);

        const result = preferPreview("localhost:3001", "docs.example.com");
        expect(result).toBe("docs.example.com");
    });

    it("should return domain when VERCEL_ENV is production (non-self-hosted)", () => {
        vi.mocked(getEnv).mockReturnValue({ VERCEL_ENV: "production" } as ReturnType<typeof getEnv>);

        const result = preferPreview("preview-host.vercel.app", "docs.example.com");
        expect(result).toBe("docs.example.com");
    });

    it("should return host when VERCEL_ENV is preview (non-self-hosted)", () => {
        vi.mocked(getEnv).mockReturnValue({ VERCEL_ENV: "preview" } as ReturnType<typeof getEnv>);

        const result = preferPreview("preview-host.vercel.app", "docs.example.com");
        expect(result).toBe("preview-host.vercel.app");
    });

    it("should return host when VERCEL_ENV is not set (non-self-hosted)", () => {
        vi.mocked(getEnv).mockReturnValue({} as ReturnType<typeof getEnv>);

        const result = preferPreview("some-host.com", "docs.example.com");
        expect(result).toBe("some-host.com");
    });

    it("should fall back to domain when host is empty and VERCEL_ENV is not production", () => {
        vi.mocked(getEnv).mockReturnValue({} as ReturnType<typeof getEnv>);

        const result = preferPreview("", "docs.example.com");
        expect(result).toBe("docs.example.com");
    });
});
