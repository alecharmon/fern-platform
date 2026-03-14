// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getHostnameFromUrl } from "@/utils/getHostnameFromUrl";

describe("getHostnameFromUrl used in notifyPostman", () => {
    it("returns hostname from a full https URL", () => {
        expect(getHostnameFromUrl("https://dark-trinity-318929-044935.docs.buildwithfern.com")).toBe(
            "dark-trinity-318929-044935.docs.buildwithfern.com"
        );
    });

    it("returns hostname from an http URL", () => {
        expect(getHostnameFromUrl("http://example.docs.buildwithfern.com")).toBe("example.docs.buildwithfern.com");
    });

    it("returns hostname from a URL with a path", () => {
        expect(getHostnameFromUrl("https://sample.docs.buildwithfern.com/some/path")).toBe(
            "sample.docs.buildwithfern.com"
        );
    });

    it("returns hostname when given a bare hostname", () => {
        expect(getHostnameFromUrl("dark-trinity-318929-044935.docs.buildwithfern.com")).toBe(
            "dark-trinity-318929-044935.docs.buildwithfern.com"
        );
    });

    it("returns hostname from a URL with a trailing slash", () => {
        expect(getHostnameFromUrl("https://example.docs.buildwithfern.com/")).toBe("example.docs.buildwithfern.com");
    });

    it("handles bare hostname with a path", () => {
        expect(getHostnameFromUrl("example.docs.buildwithfern.com/docid")).toBe("example.docs.buildwithfern.com");
    });

    it("handles dev docs domain", () => {
        expect(getHostnameFromUrl("https://sample.docs.dev.buildwithfern.com")).toBe(
            "sample.docs.dev.buildwithfern.com"
        );
    });

    it("handles custom domains", () => {
        expect(getHostnameFromUrl("https://docs.example.com")).toBe("docs.example.com");
    });

    it("handles URL with port number", () => {
        expect(getHostnameFromUrl("https://example.com:8080/path")).toBe("example.com");
    });

    it("handles URL with query parameters", () => {
        expect(getHostnameFromUrl("https://example.docs.buildwithfern.com?foo=bar")).toBe(
            "example.docs.buildwithfern.com"
        );
    });
});
