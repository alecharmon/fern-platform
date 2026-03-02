import { describe, expectTypeOf, it } from "vitest";
import type { EntitlementCheckResult, EntitlementGrant, EntitlementKey } from "../types";

describe("Entitlement types", () => {
    it("EntitlementKey is a union of defined keys", () => {
        expectTypeOf<EntitlementKey>().toEqualTypeOf<
            | "can_purchase_additional_seats"
            | "seats"
            | "docs_sites"
            | "custom_domain_subpath"
            | "ai_credits"
            | "number_of_custom_domains"
        >();
    });

    it("EntitlementGrant key is constrained to EntitlementKey", () => {
        const grant: EntitlementGrant = { key: "seats", type: "quantity", limit: 10 };
        expectTypeOf(grant.key).toEqualTypeOf<EntitlementKey>();
    });

    it("EntitlementCheckResult narrows on entitled discriminator", () => {
        // When entitled is true, type should be one of the three entitlement types
        type EntitledResult = Extract<EntitlementCheckResult, { entitled: true }>;
        expectTypeOf<EntitledResult["type"]>().toEqualTypeOf<"boolean" | "quantity" | "metered">();

        // When entitled is false, reason should be available
        type DeniedResult = Extract<EntitlementCheckResult, { entitled: false }>;
        expectTypeOf<DeniedResult["reason"]>().toEqualTypeOf<string>();
    });
});
