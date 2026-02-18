/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/font/local before importing components
vi.mock("next/font/local", () => ({
    default: () => ({
        className: "mock-font",
        style: { fontFamily: "mock-font" }
    })
}));

// Mock the pylon module
vi.mock("../pylon/getPylon", () => ({
    getPylon: vi.fn(() => undefined)
}));

import { EmailLoginForm } from "./EmailLoginForm";

describe("EmailLoginForm", () => {
    const LAST_USED_LOGIN_KEY = "fern-last-used-login";

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("shows 'Last used' badge when enterprise-sso was the last used login method", async () => {
        localStorage.setItem(LAST_USED_LOGIN_KEY, "enterprise-sso");

        render(<EmailLoginForm />);

        await waitFor(() => {
            expect(screen.getByText("Last used")).toBeDefined();
        });
    });

    it("does not show 'last used' badge when google-oauth2 was the last used login method", async () => {
        localStorage.setItem(LAST_USED_LOGIN_KEY, "google-oauth2");

        render(<EmailLoginForm />);

        // Wait for component to mount and check localStorage
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /continue/i })).toBeDefined();
        });

        expect(screen.queryByText("Last used")).toBeNull();
    });

    it("does not show 'Last used' badge when github was the last used login method", async () => {
        localStorage.setItem(LAST_USED_LOGIN_KEY, "github");

        render(<EmailLoginForm />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /continue/i })).toBeDefined();
        });

        expect(screen.queryByText("Last used")).toBeNull();
    });

    it("does not show 'Last used' badge when no previous login method exists", async () => {
        // localStorage is already cleared in beforeEach

        render(<EmailLoginForm />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /continue/i })).toBeDefined();
        });

        expect(screen.queryByText("Last used")).toBeNull();
    });

    it("saves 'enterprise-sso' to localStorage after successful form submission", async () => {
        const mockRedirectUrl = "/auth/login?connection=oktahey";

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ redirectUrl: mockRedirectUrl })
        });

        // Mock window.location.href setter
        const originalLocation = window.location;
        // @ts-expect-error - mocking location
        delete window.location;
        window.location = { ...originalLocation, href: "" } as Location;

        render(<EmailLoginForm />);

        const emailInput = screen.getByPlaceholderText("Enter email address");
        const submitButton = screen.getByRole("button", { name: /continue/i });

        fireEvent.change(emailInput, { target: { value: "user@example.com" } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(localStorage.getItem(LAST_USED_LOGIN_KEY)).toBe("enterprise-sso");
        });

        window.location = originalLocation;
    });

    it("does not save to localStorage when form submission fails", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: "user_not_found" })
        });

        render(<EmailLoginForm />);

        const emailInput = screen.getByPlaceholderText("Enter email address");
        const submitButton = screen.getByRole("button", { name: /continue/i });

        fireEvent.change(emailInput, { target: { value: "unknown@example.com" } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/We couldn't start SSO/)).toBeDefined();
        });

        expect(localStorage.getItem(LAST_USED_LOGIN_KEY)).toBeNull();
    });

    it("shows 'Authenticating...' while submitting", async () => {
        // Create a promise that we can control
        let resolvePromise: (value: unknown) => void;
        const fetchPromise = new Promise((resolve) => {
            resolvePromise = resolve;
        });

        global.fetch = vi.fn().mockReturnValue(fetchPromise);

        render(<EmailLoginForm />);

        const emailInput = screen.getByPlaceholderText("Enter email address");
        const submitButton = screen.getByRole("button", { name: /continue/i });

        fireEvent.change(emailInput, { target: { value: "user@example.com" } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText("Authenticating...")).toBeDefined();
        });

        // Resolve the promise to clean up
        resolvePromise!({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: "error" })
        });
    });
});
