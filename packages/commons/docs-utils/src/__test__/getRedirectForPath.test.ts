import type { DocsV2Read } from "@fern-api/fdr-sdk";

import { getRedirectForPath } from "../getRedirectForPath";

const MOCK_BASE_URL_0 = {
    domain: "example.com",
    basePath: undefined
} satisfies DocsV2Read.BaseUrl;

const MOCK_BASE_URL_1 = {
    domain: "example.com",
    basePath: "/docs"
} satisfies DocsV2Read.BaseUrl;

describe("getRedirectForPath", () => {
    it("should return undefined if no redirect matches", () => {
        expect(
            getRedirectForPath("/foo", MOCK_BASE_URL_0, [{ source: "/bar", destination: "/baz", permanent: undefined }])
        ).toBeUndefined();
    });
    it("should return redirect if source matches exactly", () => {
        console.log(
            "@#$",
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [{ source: "/bar", destination: "/baz", permanent: undefined }])
        );
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [{ source: "/bar", destination: "/baz", permanent: undefined }])
        ).toEqual({ destination: "/baz", permanent: true });
    });
    it("should return redirect if source matches with trailing slash", () => {
        expect(
            getRedirectForPath("/bar/", MOCK_BASE_URL_0, [
                { source: "/bar", destination: "/baz", permanent: undefined }
            ])
        ).toEqual({ destination: "/baz", permanent: true });
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [
                { source: "/bar/", destination: "/baz/", permanent: undefined }
            ])
        ).toEqual({ destination: "/baz/", permanent: true });
    });
    it("should return redirect if source matches omitting basepath", () => {
        expect(
            getRedirectForPath("/docs/bar", MOCK_BASE_URL_1, [
                { source: "/bar", destination: "/baz", permanent: undefined }
            ])
        ).toEqual({ destination: "/baz", permanent: true });
        expect(
            getRedirectForPath("/docs/bar", MOCK_BASE_URL_1, [
                { source: "/bar/", destination: "/baz/", permanent: undefined }
            ])
        ).toEqual({ destination: "/baz/", permanent: true });
    });
    it("should return redirect if source matches with basepath", () => {
        expect(
            getRedirectForPath("/docs/bar", MOCK_BASE_URL_1, [
                {
                    source: "/docs/bar",
                    destination: "/baz",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz", permanent: true });
        expect(
            getRedirectForPath("/docs/bar", MOCK_BASE_URL_1, [
                {
                    source: "/docs/bar/",
                    destination: "/baz/",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/", permanent: true });
    });
    it("should return redirect if source matches params", () => {
        expect(
            getRedirectForPath("/bar/123", MOCK_BASE_URL_0, [
                {
                    source: "/bar/:id",
                    destination: "/baz/:id",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/123", permanent: true });
        expect(
            getRedirectForPath("/bar/123", MOCK_BASE_URL_0, [
                {
                    source: "/bar/:id",
                    destination: "/baz/:id/",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/123/", permanent: true });
    });
    it("should return redirect if source matches params with basepath", () => {
        expect(
            getRedirectForPath("/docs/bar/123", MOCK_BASE_URL_1, [
                {
                    source: "/bar/:id",
                    destination: "/baz/:id",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/123", permanent: true });
        expect(
            getRedirectForPath("/docs/bar/123", MOCK_BASE_URL_1, [
                {
                    source: "/docs/bar/:id",
                    destination: "/baz/:id",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/123", permanent: true });
    });
    it("should return redirect for wildcard", () => {
        expect(
            getRedirectForPath("/docs/bar/123/456", MOCK_BASE_URL_1, [
                {
                    source: "/docs/bar/:path*",
                    destination: "/baz/:path*",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/123/456", permanent: true });
        expect(
            getRedirectForPath("/docs/bar/123/456/", MOCK_BASE_URL_1, [
                {
                    source: "/docs/bar/:path*/",
                    destination: "/baz/:path*/",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/123/456/", permanent: true });
    });
    it("should respect regex", () => {
        expect(
            getRedirectForPath("/bar/123", MOCK_BASE_URL_0, [
                {
                    source: "/bar/:id(\\d+)",
                    destination: "/baz/:id",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/123", permanent: true });
        expect(
            getRedirectForPath("/bar/abc", MOCK_BASE_URL_0, [
                {
                    source: "/bar/:id(\\d+)",
                    destination: "/baz/:id",
                    permanent: undefined
                }
            ])
        ).toBeUndefined();
        expect(
            getRedirectForPath("/bar/abc", MOCK_BASE_URL_0, [
                {
                    source: "/bar/:id(\\w+)",
                    destination: "/baz/:id",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/abc", permanent: true });
        expect(
            getRedirectForPath("/bar/efg", MOCK_BASE_URL_0, [
                {
                    source: "/bar/:param(abc|efg)",
                    destination: "/baz/:param",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz/efg", permanent: true });
    });
    it("should encode the destination", () => {
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [
                {
                    source: "/bar",
                    destination: "/baz?foo=bar",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "/baz?foo=bar", permanent: true });
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [{ source: "/bar", destination: "/a%b", permanent: undefined }])
        ).toEqual({ destination: "/a%25b", permanent: true });
    });
    it("should not try to redirect to a bad destination", () => {
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [
                {
                    source: "/bar",
                    destination: "https://n",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "https://n", permanent: true });
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [
                { source: "/bar", destination: "x/b/c", permanent: undefined }
            ])
        ).toBeUndefined();
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [
                {
                    source: "/bar",
                    destination: "absolutely",
                    permanent: undefined
                }
            ])
        ).toBeUndefined();
    });
    it("should skip redirect if destination equals source to prevent infinite loops", () => {
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [{ source: "/bar", destination: "/bar", permanent: undefined }])
        ).toBeUndefined();
        expect(
            getRedirectForPath("/bar/", MOCK_BASE_URL_0, [
                { source: "/bar", destination: "/bar/", permanent: undefined }
            ])
        ).toBeUndefined();
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [
                { source: "/bar/", destination: "/bar", permanent: undefined }
            ])
        ).toBeUndefined();
    });
    it("should skip self-redirect and continue to next redirect rule", () => {
        expect(
            getRedirectForPath("/bar", MOCK_BASE_URL_0, [
                { source: "/bar", destination: "/bar", permanent: undefined },
                { source: "/bar", destination: "/baz", permanent: undefined }
            ])
        ).toEqual({ destination: "/baz", permanent: true });
    });
    it("should skip self-redirect with params", () => {
        expect(
            getRedirectForPath("/bar/123", MOCK_BASE_URL_0, [
                { source: "/bar/:id", destination: "/bar/:id", permanent: undefined }
            ])
        ).toBeUndefined();
    });
    it("should handle external URL destinations without params", () => {
        expect(
            getRedirectForPath("/release-notes", MOCK_BASE_URL_0, [
                {
                    source: "/release-notes",
                    destination: "https://www.astronomer.io/astro-release-notes.xml",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "https://www.astronomer.io/astro-release-notes.xml", permanent: true });
    });
    it("should skip redirect sources that are absolute URLs", () => {
        expect(
            getRedirectForPath("/mock-path", MOCK_BASE_URL_0, [
                {
                    source: "https://help.customer.com",
                    destination: "/mock-redirect",
                    permanent: undefined
                }
            ])
        ).toBeUndefined();
    });
    it("should handle external URL destinations with params", () => {
        expect(
            getRedirectForPath("/bar/123", MOCK_BASE_URL_0, [
                {
                    source: "/bar/:id",
                    destination: "https://example.com/baz/:id",
                    permanent: undefined
                }
            ])
        ).toEqual({ destination: "https://example.com/baz/123", permanent: true });
    });
});
