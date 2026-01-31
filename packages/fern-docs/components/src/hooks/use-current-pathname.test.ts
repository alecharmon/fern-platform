import { parseServerSidePathname } from "./use-current-pathname";

describe("parseServerSidePathname", () => {
    it("should return the slug from new path structure", () => {
        // New path structure: /[host]/[domain]/[requiresLogin]/[isLoggedIn]/[roles]/[slug]
        expect(
            parseServerSidePathname(
                "/canary.ferndocs.com/buildwithfern.com/false/false/everyone/%2Flearn%2Fsdks%2Fcapabilities%2Fwebsockets"
            )
        ).toEqual("/learn/sdks/capabilities/websockets");
    });

    it("should return the pathname if it's not a server-side pathname", () => {
        expect(parseServerSidePathname("/api-app-run-logs")).toEqual("/api-app-run-logs");
    });

    it("should handle authenticated user with roles", () => {
        // Authenticated user with admin and developer roles
        expect(
            parseServerSidePathname(
                "/canary.ferndocs.com/buildwithfern.com/true/true/admin%2Cdeveloper%2Ceveryone/%2Fapi%2Ftest"
            )
        ).toEqual("/api/test");
    });

    it("should handle requiresLogin=true but not logged in", () => {
        // Site requires login but user is not logged in
        expect(
            parseServerSidePathname(
                "/canary.ferndocs.com/buildwithfern.com/true/false/everyone/%2Fdocs%2Fgetting-started"
            )
        ).toEqual("/docs/getting-started");
    });
});
