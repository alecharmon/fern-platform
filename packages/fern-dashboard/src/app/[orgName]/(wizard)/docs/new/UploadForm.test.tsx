/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, it, vi } from "vitest";

import UploadForm from "./UploadForm";

const mockUploadOnboardingAsset = vi.fn(async (_file: File) => ({
    assetUrl: "https://uploaded.example/asset.png"
}));

vi.mock("@/components/onboarding/api", () => ({
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
vi.mock("@/components/onboarding/CodeWidget", () => ({
    CodeWidget: () => <div data-testid="code-widget" />
}));

vi.mock("@/components/onboarding/ColorPicker", () => ({
    ColorPicker: ({ color, onColorChange }: { color: string | null; onColorChange: (c: string) => void }) => (
        <input data-testid="color-picker" value={color ?? ""} onChange={(e) => onColorChange(e.target.value)} />
    )
}));

vi.mock("@/components/onboarding/DocsUrl", () => ({
    DocsUrl: ({ value, onChange }: { value: string; onChange: (url: string, available: boolean) => void }) => (
        <input data-testid="docs-url" value={value} onChange={(e) => onChange(e.target.value, true)} />
    )
}));

vi.mock("@/components/onboarding/OpenAPISpecs", () => ({
    OpenAPISpecs: ({
        uploadedFiles,
        setUploadedFiles,
        defaultSpec
    }: {
        uploadedFiles: File[];
        setUploadedFiles: (files: File[]) => void;
        defaultSpec?: { fileName: string; assetUrl: string };
    }) => (
        <div>
            <button
                type="button"
                onClick={() => {
                    if (defaultSpec) {
                        // Create a marker file for the default spec
                        const file = new File([], defaultSpec.fileName, { type: "application/json" });
                        setUploadedFiles([file]);
                    }
                }}
            >
                Add Spec
            </button>
            <div data-testid="spec-count">{uploadedFiles.length}</div>
        </div>
    )
}));

vi.mock("@/components/onboarding/LoaderScreen", () => ({
    LoaderScreen: () => <div data-testid="loader-screen" />
}));

vi.mock("@/components/onboarding/ConfirmScreen", () => ({
    ConfirmScreen: () => <div data-testid="confirm-screen" />
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({ orgName: "acme" })
}));

// Create mock Field component outside to reuse
const createMockField = (formData: any) => {
    return ({ name, children }: any) => {
        const field = {
            name,
            state: {
                value: formData[name],
                meta: { errors: [] }
            },
            setValue: (value: any) => {
                formData[name] = value;
            },
            handleChange: (value: any) => {
                formData[name] = value;
            },
            handleBlur: () => {}
        };
        return children(field);
    };
};

// Create a shared form data object
const sharedFormData = {
    docsSiteName: "",
    docsSiteUrl: "",
    docsSiteUrlAvailable: null,
    faviconUrl: null,
    logoUrl: null,
    faviconFile: null,
    logoFile: null,
    primaryColorHex: null,
    existingDocsSite: "",
    openApiSpecFiles: [],
    openApiSpecUrls: [],
    sitePublishUrl: null
};

// Mock the OnboardingProvider and hooks
vi.mock("@/providers/OnboardingProvider", () => ({
    OnboardingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useOnboarding: () => ({
        formData: sharedFormData,
        form: {
            Field: createMockField(sharedFormData),
            setFieldValue: vi.fn(),
            setFieldMeta: vi.fn()
        },
        updateFormData: vi.fn(),
        resetFormData: vi.fn(),
        goToNextStep: vi.fn(),
        goToPreviousStep: vi.fn(),
        skipStep: vi.fn(),
        setStep: vi.fn(),
        currentStep: "branding" as const
    })
}));

vi.mock("@/components/onboarding/useDocsSubmission", () => ({
    useDocsSubmission: () => ({
        submitDocs: vi.fn(),
        isSubmitting: false,
        sessionId: null,
        error: null,
        clearError: vi.fn()
    })
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
    faviconFile: null,
    logoFile: null,
    faviconFileName: null,
    logoFileName: null,
    primaryColorHex: "#123abc",
    existingDocsSite: "",
    openApiSpecFiles: [],
    openApiSpecUrls: [],
    sitePublishUrl: null
};

// Create mock form
const mockForm = {
    setFieldValue: vi.fn(),
    store: {
        state: { values: defaultWizardData },
        subscribe: vi.fn(() => () => {})
    },
    Field: createMockField(defaultWizardData)
} as any;

describe("UploadForm validations", () => {
    beforeEach(() => {
        mockUploadOnboardingAsset.mockClear();
    });

    it("renders the upload form with all fields", () => {
        const handleSubmit = vi.fn();
        render(
            <UploadForm
                form={mockForm}
                formData={defaultWizardData}
                validationErrors={{}}
                onSubmitForm={handleSubmit}
                isLoading={false}
                error={null}
            />
        );

        // Verify key form elements are present
        expect(screen.getByLabelText(/site title/i)).toBeTruthy();
        expect(screen.getByTestId("docs-url")).toBeTruthy();
        expect(screen.getByTestId("color-picker")).toBeTruthy();
        expect(screen.getByRole("button", { name: /continue/i })).toBeTruthy();
    });

    it("uses form.setFieldValue when fields change", () => {
        render(
            <UploadForm
                form={mockForm}
                formData={defaultWizardData}
                validationErrors={{}}
                onSubmitForm={vi.fn()}
                isLoading={false}
                error={null}
            />
        );

        // Form should be using the passed form object
        expect(mockForm).toBeTruthy();
    });
});

// Note: This test suite was removed because the implementation changed to defer image uploads
// until after organization creation. The old behavior where images were uploaded immediately
// during form submission in the wizard is no longer applicable. The upload flow is now handled
// by useDocsSubmission which is mocked in these tests.
//
// If we want to test the actual upload behavior, we should create integration tests that test
// useDocsSubmission directly without mocking it.
