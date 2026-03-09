/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsCard } from "../SettingsCard";

describe("SettingsCard", () => {
    it("renders title, description, and button", () => {
        render(<SettingsCard title="Test Title" description="Test description" button={<button>Click me</button>} />);

        expect(screen.getByText("Test Title")).toBeDefined();
        expect(screen.getByText("Test description")).toBeDefined();
        expect(screen.getByRole("button", { name: "Click me" })).toBeDefined();
    });

    it("renders children on the same row as button, aligned left", () => {
        const { container } = render(
            <SettingsCard title="Title" description="Description" button={<button>Action</button>}>
                <p data-testid="child-content">Extra content</p>
            </SettingsCard>
        );

        expect(screen.getByTestId("child-content")).toBeDefined();
        expect(screen.getByText("Extra content")).toBeDefined();

        // Verify card has description group and button row (which contains children + button)
        const cardDiv = container.firstElementChild!;
        const children = Array.from(cardDiv.children);
        expect(children.length).toBe(2);
    });

    it("renders without children (backwards compatible)", () => {
        const { container } = render(
            <SettingsCard title="Title" description="Description" button={<button>Action</button>} />
        );

        expect(screen.getByText("Title")).toBeDefined();
        expect(screen.getByText("Description")).toBeDefined();
        // No extra child nodes beyond the description group and button group
        const cardDiv = container.firstElementChild!;
        const children = Array.from(cardDiv.children);
        expect(children.length).toBe(2);
    });
});
