import { describe, expect, it } from "vitest";
import { formatCentsAsDollars } from "../formatCentsAsDollars";

describe("formatCentsAsDollars", () => {
    it("formats whole dollar amounts", () => {
        expect(formatCentsAsDollars(2000, "usd")).toBe("$20.00");
    });

    it("formats amounts with cents", () => {
        expect(formatCentsAsDollars(2150, "usd")).toBe("$21.50");
    });

    it("formats zero", () => {
        expect(formatCentsAsDollars(0, "usd")).toBe("$0.00");
    });

    it("formats large amounts correctly", () => {
        expect(formatCentsAsDollars(100000, "usd")).toBe("$1,000.00");
    });
});
