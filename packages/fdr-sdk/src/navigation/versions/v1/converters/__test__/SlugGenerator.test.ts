import { SlugGenerator } from "../SlugGenerator";

describe("SlugGenerator", () => {
    describe("basic operations", () => {
        it("should append a new slug to the base", () => {
            const slug = SlugGenerator.init("base").append("slug");
            expect(slug.get()).toBe("base/slug");
        });

        it("should set a new slug with basepath", () => {
            const slug = SlugGenerator.init("base").set("slug");
            expect(slug.get()).toBe("base/slug");
        });

        it("should not duplicate basepath when it's already present", () => {
            const slug = SlugGenerator.init("base").set("base/slug");
            expect(slug.get()).toBe("base/slug");
        });
    });

    describe("version handling", () => {
        it("should prevent setting version twice", () => {
            expect(() => {
                SlugGenerator.init("base").setVersionSlug("version").setVersionSlug("version2");
            }).toThrowError("Version already set");
        });

        it("should append version to a new slug", () => {
            const slug = SlugGenerator.init("base").setVersionSlug("version").set("slug");
            expect(slug.get()).toBe("base/version/slug");
        });

        it("should not duplicate version when it's already present", () => {
            const slug = SlugGenerator.init("base").setVersionSlug("version").set("base/version/slug");
            expect(slug.get()).toBe("base/version/slug");
        });

        it("should insert version between base and slug when basepath exists", () => {
            const slug = SlugGenerator.init("base").setVersionSlug("version").set("base/slug");
            expect(slug.get()).toBe("base/version/slug");
        });
    });

    describe("product handling", () => {
        it("should prevent setting product twice", () => {
            expect(() => {
                SlugGenerator.init("base").setProductSlug("product").setProductSlug("product2");
            }).toThrowError("Product already set");
        });

        it("should prevent product slug from being same as base slug", () => {
            expect(() => {
                SlugGenerator.init("base").setProductSlug("base");
            }).toThrowError("Product slug is the same as base slug");
        });

        it("should append product slug to base", () => {
            const slug = SlugGenerator.init("base").setProductSlug("product");
            expect(slug.get()).toBe("base/product");
        });

        it("should not duplicate product when it's already present", () => {
            const slug = SlugGenerator.init("base").setProductSlug("product").set("base/product/slug");
            expect(slug.get()).toBe("base/product/slug");
        });
    });

    describe("product and version interaction", () => {
        it("should maintain correct order: base/product/version", () => {
            const slug = SlugGenerator.init("base").setProductSlug("product").setVersionSlug("version");
            expect(slug.get()).toBe("base/product/version");
        });

        it("should append slug after product and version", () => {
            const slug = SlugGenerator.init("base").setProductSlug("product").setVersionSlug("version").set("slug");
            expect(slug.get()).toBe("base/product/version/slug");
        });

        it("should insert version between product and slug when needed", () => {
            const slug = SlugGenerator.init("base")
                .setProductSlug("product")
                .setVersionSlug("version")
                .set("base/product/slug");
            expect(slug.get()).toBe("base/product/version/slug");
        });
    });

    describe("apply method", () => {
        it("should respect skipUrlSlug even when fullSlug is present", () => {
            const slug = SlugGenerator.init("base").apply({
                fullSlug: ["section-intro"],
                urlSlug: "section-intro",
                skipUrlSlug: true
            });
            expect(slug.get()).toBe("base");
        });

        it("should use fullSlug when skipUrlSlug is false", () => {
            const slug = SlugGenerator.init("base").apply({
                fullSlug: ["section-intro"],
                urlSlug: "section-intro",
                skipUrlSlug: false
            });
            expect(slug.get()).toBe("base/section-intro");
        });

        it("should use fullSlug when skipUrlSlug is not set", () => {
            const slug = SlugGenerator.init("base").apply({
                fullSlug: ["section-intro"],
                urlSlug: "section-intro"
            });
            expect(slug.get()).toBe("base/section-intro");
        });

        it("should skip url slug when skipUrlSlug is true and no fullSlug", () => {
            const slug = SlugGenerator.init("base").apply({
                urlSlug: "section",
                skipUrlSlug: true
            });
            expect(slug.get()).toBe("base");
        });

        it("should append urlSlug when no fullSlug and skipUrlSlug is false", () => {
            const slug = SlugGenerator.init("base").apply({
                urlSlug: "section",
                skipUrlSlug: false
            });
            expect(slug.get()).toBe("base/section");
        });
    });

    describe("path normalization", () => {
        it("should normalize malformed paths with version", () => {
            const slug = SlugGenerator.init("/base").setVersionSlug("version ").append("//slug");
            expect(slug.get()).toBe("base/version/slug");
        });

        it("should normalize malformed paths with product and version", () => {
            const slug = SlugGenerator.init("/base")
                .setProductSlug(" product ")
                .setVersionSlug("version ")
                .append("//slug");
            expect(slug.get()).toBe("base/product/version/slug");
        });
    });
});
