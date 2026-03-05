import type { EntitlementCheckResult, EntitlementKey } from "@fern-platform/entitlements";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntitlementGate } from "../EntitlementGate";

function entitled(): EntitlementCheckResult {
    return { entitled: true, type: "boolean" };
}

function denied(): EntitlementCheckResult {
    return { entitled: false, reason: "limit reached" };
}

function quantityEntitled(remaining: number, limit: number): EntitlementCheckResult {
    return { entitled: true, type: "quantity", remaining, limit, used: limit - remaining };
}

function makeEntitlements(
    overrides: Partial<Record<EntitlementKey, EntitlementCheckResult>> = {}
): Record<EntitlementKey, EntitlementCheckResult> {
    return {
        can_purchase_additional_seats: denied(),
        seats: denied(),
        docs_sites: denied(),
        custom_domain_subpath: denied(),
        ...overrides
    };
}

describe("EntitlementGate", () => {
    describe("enabled=false (explicit)", () => {
        it("renders children regardless of entitlements", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements()}
                    required="seats"
                    enabled={false}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("content")).toBeDefined();
            expect(screen.queryByText("blocked")).toBeNull();
        });
    });

    describe("enabled=true (default)", () => {
        it("renders children when entitled (single key)", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements({ seats: entitled() })}
                    required="seats"
                    enabled={true}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("content")).toBeDefined();
            expect(screen.queryByText("blocked")).toBeNull();
        });

        it("renders fallback when not entitled (single key)", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements({ seats: denied() })}
                    required="seats"
                    enabled={true}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("blocked")).toBeDefined();
            expect(screen.queryByText("content")).toBeNull();
        });

        it("renders nothing when not entitled and no fallback provided", () => {
            const { container } = render(
                <EntitlementGate entitlements={makeEntitlements({ seats: denied() })} required="seats" enabled={true}>
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.queryByText("content")).toBeNull();
            expect(container.innerHTML).toBe("");
        });

        it("works with quantity entitlements", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements({ seats: quantityEntitled(3, 5) })}
                    required="seats"
                    enabled={true}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("content")).toBeDefined();
        });
    });

    describe("mode='all' (default)", () => {
        it("renders children when all required keys are entitled", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements({ seats: entitled(), docs_sites: entitled() })}
                    required={["seats", "docs_sites"]}
                    enabled={true}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("content")).toBeDefined();
        });

        it("renders fallback when any required key is denied", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements({ seats: entitled(), docs_sites: denied() })}
                    required={["seats", "docs_sites"]}
                    enabled={true}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("blocked")).toBeDefined();
            expect(screen.queryByText("content")).toBeNull();
        });
    });

    describe("mode='any'", () => {
        it("renders children when at least one required key is entitled", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements({ seats: entitled(), docs_sites: denied() })}
                    required={["seats", "docs_sites"]}
                    mode="any"
                    enabled={true}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("content")).toBeDefined();
        });

        it("renders fallback when all required keys are denied", () => {
            render(
                <EntitlementGate
                    entitlements={makeEntitlements({ seats: denied(), docs_sites: denied() })}
                    required={["seats", "docs_sites"]}
                    mode="any"
                    enabled={true}
                    fallback={<p>blocked</p>}
                >
                    <p>content</p>
                </EntitlementGate>
            );

            expect(screen.getByText("blocked")).toBeDefined();
            expect(screen.queryByText("content")).toBeNull();
        });
    });
});
