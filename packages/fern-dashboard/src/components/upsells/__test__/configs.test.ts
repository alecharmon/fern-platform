import { describe, expect, it } from "vitest";

import { UPSELL_CONFIGS } from "../configs";

describe("UPSELL_CONFIGS", () => {
    it("has a config for every feature", () => {
        expect(UPSELL_CONFIGS.seats).toBeDefined();
        expect(UPSELL_CONFIGS.ai_credits).toBeDefined();
        expect(UPSELL_CONFIGS.custom_domain_subpath).toBeDefined();
        expect(UPSELL_CONFIGS.docs_sites).toBeDefined();
        expect(UPSELL_CONFIGS.custom_domains).toBeDefined();
        expect(UPSELL_CONFIGS.pdf_export).toBeDefined();
    });

    it("each config has required fields", () => {
        for (const [, config] of Object.entries(UPSELL_CONFIGS)) {
            expect(config.title).toBeTruthy();
            expect(config.icon).toBeDefined();
            expect(config.actions.free).toBeDefined();
        }
    });

    it("seats has checkout action for paid tier", () => {
        const seatsAction = UPSELL_CONFIGS.seats.actions.paid;
        expect(seatsAction).toBeDefined();
        expect(seatsAction!.type).toBe("checkout");
    });

    it("free tier actions are redirect or pylon", () => {
        for (const [, config] of Object.entries(UPSELL_CONFIGS)) {
            expect(["redirect", "pylon"]).toContain(config.actions.free!.type);
        }
    });

    it("seats free tier has no learn more URL", () => {
        expect(UPSELL_CONFIGS.seats.learnMoreUrl).toBeUndefined();
    });

    it("seats paid tier has learn more URL via tierOverrides", () => {
        expect(UPSELL_CONFIGS.seats.tierOverrides?.paid?.learnMoreUrl).toBeTruthy();
    });

    it("ai_credits and custom_domain_subpath have learn more URLs", () => {
        expect(UPSELL_CONFIGS.ai_credits.learnMoreUrl).toBeTruthy();
        expect(UPSELL_CONFIGS.custom_domain_subpath.learnMoreUrl).toBeTruthy();
    });

    it("seats paid tier overrides title", () => {
        const override = UPSELL_CONFIGS.seats.tierOverrides?.paid;
        expect(override?.title).toBe("Manage amount of members");
    });

    it("ai_credits paid tier overrides title", () => {
        const override = UPSELL_CONFIGS.ai_credits.tierOverrides?.paid;
        expect(override?.title).toBe("Add additional AI credits to your plan");
    });
});
