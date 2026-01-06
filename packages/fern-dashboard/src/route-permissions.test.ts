import { route, routeWithResource } from "./route-permissions";

describe("route", () => {
    it("should match exact paths", () => {
        const config = route("/api/users", "manage-users");
        expect(config.pattern.test("/api/users")).toBe(true);
        expect(config.pattern.test("/api/users/")).toBe(false);
        expect(config.pattern.test("/api/settings")).toBe(false);
    });

    it("should match paths with wildcard suffix", () => {
        const config = route("/api/users*", "manage-users");
        expect(config.pattern.test("/api/users")).toBe(true);
        expect(config.pattern.test("/api/users/")).toBe(true);
        expect(config.pattern.test("/api/users/123")).toBe(true);
        expect(config.pattern.test("/api/users/123/edit")).toBe(true);
        expect(config.pattern.test("/api/settings")).toBe(false);
    });

    it("should match paths with :param segments", () => {
        const config = route("/:org/docs/:docUrl/settings", "manage-settings");
        expect(config.pattern.test("/acme/docs/my-doc/settings")).toBe(true);
        expect(config.pattern.test("/foo/docs/bar/settings")).toBe(true);
        expect(config.pattern.test("/acme/docs/my-doc/members")).toBe(false);
        expect(config.pattern.test("/docs/my-doc/settings")).toBe(false);
    });

    it("should match paths with :param segments and wildcard", () => {
        const config = route("/:org/docs/:docUrl/settings*", "manage-settings");
        expect(config.pattern.test("/acme/docs/my-doc/settings")).toBe(true);
        expect(config.pattern.test("/acme/docs/my-doc/settings/")).toBe(true);
        expect(config.pattern.test("/acme/docs/my-doc/settings/advanced")).toBe(true);
        expect(config.pattern.test("/acme/docs/my-doc/settings/advanced/foo")).toBe(true);
    });

    it("should set the correct requiredPermission", () => {
        const config = route("/api/users", "manage-users");
        expect(config.requiredPermission).toBe("manage-users");
    });

    it("should not have resourceScope", () => {
        const config = route("/api/users", "manage-users");
        expect(config.resourceScope).toBeUndefined();
    });
});

describe("routeWithResource", () => {
    it("should match paths and capture the resource ID", () => {
        const config = routeWithResource("/:org/docs/:docUrl/members*", "manage-users", "docUrl");
        expect(config.pattern.test("/acme/docs/my-doc/members")).toBe(true);
        expect(config.pattern.test("/acme/docs/my-doc/members/")).toBe(true);
        expect(config.pattern.test("/acme/docs/my-doc/members/invite")).toBe(true);
        // Paths without /members should not match
        expect(config.pattern.test("/alecharmonspot/docs/spots-alecharmon-test.docs.buildwithfern.com")).toBe(false);
    });

    it("should set the correct captureGroup for the resource param", () => {
        const config = routeWithResource("/:org/docs/:docUrl/members*", "manage-users", "docUrl");
        expect(config.resourceScope).toBeDefined();
        expect(config.resourceScope?.captureGroup).toBe(2); // :org is 1, :docUrl is 2
    });

    it("should extract the correct resource ID from the path", () => {
        const config = routeWithResource("/:org/docs/:docUrl/members*", "manage-users", "docUrl");
        const match = config.pattern.exec("/acme/docs/my-doc-site/members/invite");
        expect(match).not.toBeNull();
        expect(match![config.resourceScope!.captureGroup]).toBe("my-doc-site");
    });

    it("should handle first param as resource", () => {
        const config = routeWithResource("/:docUrl/settings*", "manage-settings", "docUrl");
        expect(config.resourceScope?.captureGroup).toBe(1);

        const match = config.pattern.exec("/my-doc/settings/advanced");
        expect(match![config.resourceScope!.captureGroup]).toBe("my-doc");
    });

    it("should set the correct resourceType", () => {
        const config = routeWithResource("/:org/docs/:docUrl/members*", "manage-users", "docUrl");
        expect(config.resourceScope?.resourceType).toBe("docs");
    });

    it("should allow custom resourceType", () => {
        const config = routeWithResource("/:org/apis/:apiId/settings*", "manage-settings", "apiId", "docs");
        expect(config.resourceScope?.resourceType).toBe("docs");
    });

    it("should set the correct requiredPermission", () => {
        const config = routeWithResource("/:org/docs/:docUrl/members*", "manage-users", "docUrl");
        expect(config.requiredPermission).toBe("manage-users");
    });
});
