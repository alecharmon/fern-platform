import { describe, expect, it } from "vitest";

import { buildSourceLine, slackLink } from "../notifyDocsOnboardingComplete.helpers";

describe("slackLink", () => {
    it("strips https:// and wraps in Slack hyperlink format", () => {
        expect(slackLink("https://example.docs.buildwithfern.com")).toBe(
            "<https://example.docs.buildwithfern.com|example.docs.buildwithfern.com>"
        );
    });

    it("strips https:// and github.com/ for GitHub URLs", () => {
        expect(slackLink("https://github.com/fern-support/acme")).toBe(
            "<https://github.com/fern-support/acme|fern-support/acme>"
        );
    });

    it("strips http:// prefix", () => {
        expect(slackLink("http://example.com")).toBe("<http://example.com|example.com>");
    });

    it("handles dashboard URLs", () => {
        expect(slackLink("https://dashboard.buildwithfern.com/acme/docs/acme.docs.buildwithfern.com")).toBe(
            "<https://dashboard.buildwithfern.com/acme/docs/acme.docs.buildwithfern.com|dashboard.buildwithfern.com/acme/docs/acme.docs.buildwithfern.com>"
        );
    });

    it("handles URL without protocol gracefully", () => {
        expect(slackLink("example.com")).toBe("<example.com|example.com>");
    });
});

describe("buildSourceLine", () => {
    it("returns 'Direct' when no fields are provided", () => {
        expect(buildSourceLine({})).toBe("Direct");
    });

    it("returns 'Direct' when all fields are null", () => {
        expect(
            buildSourceLine({
                postmanCollectionId: null,
                initialReferrer: null,
                utmSource: null,
                utmMedium: null,
                utmCampaign: null
            })
        ).toBe("Direct");
    });

    it("returns 'Direct' when all fields are undefined", () => {
        expect(
            buildSourceLine({
                postmanCollectionId: undefined,
                initialReferrer: undefined,
                utmSource: undefined,
                utmMedium: undefined,
                utmCampaign: undefined
            })
        ).toBe("Direct");
    });

    it("shows Postman source with collection ID", () => {
        expect(buildSourceLine({ postmanCollectionId: "12345-abcd" })).toBe("*Postman* (collection ID: 12345-abcd)");
    });

    it("shows Postman source with referrer", () => {
        expect(buildSourceLine({ postmanCollectionId: "12345", initialReferrer: "postman.com" })).toBe(
            "*Postman* (collection ID: 12345) | Referrer: postman.com"
        );
    });

    it("shows Direct with referrer", () => {
        expect(buildSourceLine({ initialReferrer: "google.com" })).toBe("Direct | Referrer: google.com");
    });

    it("filters out $direct referrer sentinel", () => {
        expect(buildSourceLine({ initialReferrer: "$direct" })).toBe("Direct");
    });

    it("filters out empty string referrer", () => {
        expect(buildSourceLine({ initialReferrer: "" })).toBe("Direct");
    });

    it("shows UTM source only", () => {
        expect(buildSourceLine({ utmSource: "twitter" })).toBe("Direct | UTM: source=twitter");
    });

    it("shows UTM medium only", () => {
        expect(buildSourceLine({ utmMedium: "email" })).toBe("Direct | UTM: medium=email");
    });

    it("shows UTM campaign only", () => {
        expect(buildSourceLine({ utmCampaign: "launch-2026" })).toBe("Direct | UTM: campaign=launch-2026");
    });

    it("shows all UTM params together", () => {
        expect(buildSourceLine({ utmSource: "twitter", utmMedium: "social", utmCampaign: "launch" })).toBe(
            "Direct | UTM: source=twitter, medium=social, campaign=launch"
        );
    });

    it("shows referrer and UTM together", () => {
        expect(
            buildSourceLine({
                initialReferrer: "t.co",
                utmSource: "twitter",
                utmMedium: "social",
                utmCampaign: "launch"
            })
        ).toBe("Direct | Referrer: t.co | UTM: source=twitter, medium=social, campaign=launch");
    });

    it("shows Postman with referrer and UTM", () => {
        expect(
            buildSourceLine({
                postmanCollectionId: "abc",
                initialReferrer: "postman.com",
                utmSource: "partner",
                utmCampaign: "postman-integration"
            })
        ).toBe(
            "*Postman* (collection ID: abc) | Referrer: postman.com | UTM: source=partner, campaign=postman-integration"
        );
    });

    it("handles null UTM fields gracefully", () => {
        expect(
            buildSourceLine({
                initialReferrer: "google.com",
                utmSource: null,
                utmMedium: null,
                utmCampaign: null
            })
        ).toBe("Direct | Referrer: google.com");
    });
});
