/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewDocsWizardPage from "./page";
import UploadForm from "./UploadForm";

const mockUploadOnboardingAsset = vi.fn(async (_file: File) => ({
    assetUrl: "https://uploaded.example/asset.png"
}));

vi.mock("./api", () => ({
    uploadOnboardingAsset: (...args: any[]) =>
        mockUploadOnboardingAsset(...(args as Parameters<typeof mockUploadOnboardingAsset>))
}));

// Stub motion to avoid animation churn in tests
vi.mock("motion/react", () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />
    }
}));

// Lightweight stubs for heavy child components
vi.mock("./CodeWidget", () => ({
    default: () => <div data-testid="code-widget" />
}));

vi.mock("./ColorPicker", () => ({
    default: ({ color, onColorChange }: { color: string | null; onColorChange: (c: string) => void }) => (
        <input data-testid="color-picker" value={color ?? ""} onChange={(e) => onColorChange(e.target.value)} />
    )
}));

vi.mock("./DocsUrl", () => ({
    default: ({ value, onChange }: { value: string; onChange: (url: string, available: boolean) => void }) => (
        <input data-testid="docs-url" value={value} onChange={(e) => onChange(e.target.value, true)} />
    )
}));

vi.mock("./OpenAPISpecs", () => ({
    default: ({
        uploadedSpecs,
        setUploadedSpecs,
        defaultSpec
    }: {
        uploadedSpecs: { fileName: string; assetUrl: string }[];
        setUploadedSpecs: (specs: { fileName: string; assetUrl: string }[]) => void;
        defaultSpec?: { fileName: string; assetUrl: string };
    }) => (
        <div>
            <button
                type="button"
                onClick={() => {
                    if (defaultSpec) {
                        setUploadedSpecs([defaultSpec]);
                    }
                }}
            >
                Add Spec
            </button>
            <div data-testid="spec-count">{uploadedSpecs.length}</div>
        </div>
    )
}));

vi.mock("./LoaderScreen", () => ({
    default: () => <div data-testid="loader-screen" />
}));

vi.mock("./ConfirmScreen", () => ({
    default: () => <div data-testid="confirm-screen" />
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({ orgName: "acme" })
}));

vi.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>
}));

const DEFAULT_BRANDFETCH =
    "https://cdn.brandfetch.io/idPXovIzxA/w/400/h/400/id6bO_yJUx.png?c=1bxid64Mup7aczewSAYMX&t=1745869970633";

const defaultWizardData = {
    docsSiteName: "",
    docsSiteUrl: "",
    docsSiteUrlAvailable: null,
    faviconUrl: DEFAULT_BRANDFETCH,
    logoUrl: DEFAULT_BRANDFETCH,
    primaryColorHex: "#123abc",
    existingDocsSite: "",
    openApiSpecUrls: []
};

describe("UploadForm validations", () => {
    beforeEach(() => {
        mockUploadOnboardingAsset.mockClear();
    });

    it("shows an error when site title is missing", async () => {
        const handleSubmit = vi.fn();
        render(
            <UploadForm
                wizardFormData={defaultWizardData}
                setWizardFormData={vi.fn()}
                onSubmitForm={handleSubmit}
                isLoading={false}
                error={null}
            />
        );

        // Add a spec so only the title validation can fail
        fireEvent.click(screen.getByText("Add Spec"));
        // Fill valid subdomain
        fireEvent.change(screen.getByTestId("docs-url"), { target: { value: "valid-subdomain" } });

        fireEvent.click(screen.getByRole("button", { name: /continue/i }));

        await screen.findByText("Site title is required.");
        expect(handleSubmit).not.toHaveBeenCalled();
    });

    it("requires at least one API spec", async () => {
        const handleSubmit = vi.fn();
        render(
            <UploadForm
                wizardFormData={{ ...defaultWizardData, docsSiteName: "Valid Name", docsSiteUrl: "valid-url" }}
                setWizardFormData={vi.fn()}
                onSubmitForm={handleSubmit}
                isLoading={false}
                error={null}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: /continue/i }));

        await screen.findByText("Add at least one API spec. Use the default if you don't have one yet.");
        expect(handleSubmit).not.toHaveBeenCalled();
    });
});

describe("NewDocsWizardPage default image handling", () => {
    const originalFetch = global.fetch;
    let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

    beforeEach(() => {
        mockUploadOnboardingAsset.mockClear();
        fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
            if (url === "/api/brand-assets/auto-populate") {
                return new Response(JSON.stringify({ updates: {} }), { status: 200 });
            }
            if (url.includes("brandfetch.io")) {
                return new Response(new Blob(["image"], { type: "image/png" }), { status: 200 });
            }

            if (url === "/api/onboarding-docs") {
                return new Response(JSON.stringify({ ok: true }), { status: 200 });
            }

            throw new Error(`Unhandled fetch for ${url}`);
        });
        global.fetch = fetchMock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("uploads the default images when none are provided by the user", async () => {
        render(<NewDocsWizardPage />);

        fireEvent.change(screen.getByLabelText("Site title"), { target: { value: "My Docs" } });
        fireEvent.change(screen.getByTestId("docs-url"), { target: { value: "my-docs" } });
        fireEvent.change(screen.getByTestId("color-picker"), { target: { value: "#ffffff" } });
        fireEvent.click(screen.getByText("Add Spec"));

        expect((screen.getByLabelText("Site title") as HTMLInputElement).value).toBe("My Docs");
        expect((screen.getByTestId("docs-url") as HTMLInputElement).value).toBe("my-docs");
        expect((screen.getByTestId("color-picker") as HTMLInputElement).value).toBe("#ffffff");

        await waitFor(() => expect(screen.getByTestId("spec-count").textContent).toBe("1"));

        fireEvent.click(screen.getByRole("button", { name: /continue/i }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const urls = fetchMock.mock.calls.map((call: Parameters<typeof fetch>) => call[0]?.toString());
        expect(urls).toContain("/api/onboarding-docs");
        expect(urls.some((url: string | undefined) => url?.includes("brandfetch.io"))).toBe(true);

        await waitFor(() => {
            expect(mockUploadOnboardingAsset).toHaveBeenCalledTimes(2);
        });

        const fileNames = mockUploadOnboardingAsset.mock.calls.map((call) => (call[0] as File).name);
        expect(fileNames).toEqual(expect.arrayContaining(["favicon-default.png", "logo-default.png"]));
    });
});
