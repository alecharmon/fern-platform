import { describe, expect, it } from "vitest";

import { DEFAULT_CTA_LABELS, UPSELL_FEATURE_ENTITLEMENT_MAP } from "../types";

describe("UPSELL_FEATURE_ENTITLEMENT_MAP", () => {
    it("maps every UpsellFeature to a valid EntitlementKey", () => {
        expect(UPSELL_FEATURE_ENTITLEMENT_MAP.seats).toBe("seats");
        expect(UPSELL_FEATURE_ENTITLEMENT_MAP.ai_credits).toBe("ai_credits");
        expect(UPSELL_FEATURE_ENTITLEMENT_MAP.custom_domain_subpath).toBe("custom_domain_subpath");
        expect(UPSELL_FEATURE_ENTITLEMENT_MAP.docs_sites).toBe("docs_sites");
    });
});

describe("DEFAULT_CTA_LABELS", () => {
    it("has labels for all action types", () => {
        expect(DEFAULT_CTA_LABELS.redirect).toBe("Upgrade to Pro");
        expect(DEFAULT_CTA_LABELS.checkout).toBe("Continue to checkout");
        expect(DEFAULT_CTA_LABELS["contact-sales"]).toBe("Contact sales");
    });
});
