import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * @vitest-environment jsdom
 */

vi.mock("mdx-bundler/client", () => ({
    getMDXExport: vi.fn()
}));

import { getMDXExport } from "mdx-bundler/client";
import { CustomComponent } from "../CustomComponent";

const mockGetMDXExport = vi.mocked(getMDXExport);

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("CustomComponent", () => {
    describe("when code has no default export", () => {
        it("renders an error UI when no default export found", () => {
            mockGetMDXExport.mockReturnValue({});

            render(<CustomComponent code="invalid code" />);

            expect(screen.getByText("Custom Component Error")).toBeDefined();
            expect(
                screen.getByText(
                    "No default export found in custom component. Make sure your component has a default export."
                )
            ).toBeDefined();
        });

        it("renders an error UI when exports is undefined", () => {
            mockGetMDXExport.mockReturnValue(undefined as unknown as Record<string, unknown>);

            render(<CustomComponent code="invalid code" />);

            expect(screen.getByText("Custom Component Error")).toBeDefined();
        });
    });

    describe("when code has a valid default export", () => {
        it("renders the component from the default export", () => {
            const TestComponent = () => <div data-testid="test-component">Hello World</div>;
            mockGetMDXExport.mockReturnValue({ default: TestComponent });

            render(<CustomComponent code="valid code" />);

            expect(screen.getByTestId("test-component")).toBeDefined();
            expect(screen.getByText("Hello World")).toBeDefined();
        });

        it("wraps the component in a div with the provided className", () => {
            const TestComponent = () => <span>Content</span>;
            mockGetMDXExport.mockReturnValue({ default: TestComponent });

            const { container } = render(<CustomComponent code="valid code" className="custom-class" />);

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper.className).toContain("custom-class");
        });

        it("renders without className when not provided", () => {
            const TestComponent = () => <span>Content</span>;
            mockGetMDXExport.mockReturnValue({ default: TestComponent });

            const { container } = render(<CustomComponent code="valid code" />);

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper.className).toBe("");
        });
    });

    describe("getMDXExport integration", () => {
        it("passes the code to getMDXExport with correct globals", () => {
            const TestComponent = () => <div>Test</div>;
            mockGetMDXExport.mockReturnValue({ default: TestComponent });

            render(<CustomComponent code="test-code-string" />);

            expect(mockGetMDXExport).toHaveBeenCalledWith(
                "test-code-string",
                expect.objectContaining({
                    React: expect.anything(),
                    ReactDOM: expect.anything(),
                    _jsx_runtime: expect.anything()
                })
            );
        });
    });

    describe("memoization", () => {
        it("does not re-render when code and className are the same", () => {
            const TestComponent = vi.fn(() => <div>Memoized</div>);
            mockGetMDXExport.mockReturnValue({ default: TestComponent });

            const { rerender } = render(<CustomComponent code="same-code" className="same-class" />);

            expect(TestComponent).toHaveBeenCalledTimes(1);

            rerender(<CustomComponent code="same-code" className="same-class" />);

            expect(TestComponent).toHaveBeenCalledTimes(1);
        });

        it("re-renders when code changes", () => {
            const TestComponent = vi.fn(() => <div>Component</div>);
            mockGetMDXExport.mockReturnValue({ default: TestComponent });

            const { rerender } = render(<CustomComponent code="code-v1" />);

            expect(TestComponent).toHaveBeenCalledTimes(1);

            rerender(<CustomComponent code="code-v2" />);

            expect(TestComponent).toHaveBeenCalledTimes(2);
        });

        it("re-renders when className changes", () => {
            const TestComponent = vi.fn(() => <div>Component</div>);
            mockGetMDXExport.mockReturnValue({ default: TestComponent });

            const { rerender } = render(<CustomComponent code="same-code" className="class-v1" />);

            expect(TestComponent).toHaveBeenCalledTimes(1);

            rerender(<CustomComponent code="same-code" className="class-v2" />);

            expect(TestComponent).toHaveBeenCalledTimes(2);
        });
    });
});
