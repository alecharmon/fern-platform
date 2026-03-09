import { describe, expect, it } from "vitest";

import { DocsSectionSchema as DbDocsSectionSchema, NavigationItemSchema as DbNavigationItemSchema } from "../db";
import { DocsSectionSchema as ReadDocsSectionSchema, NavigationItemSchema as ReadNavigationItemSchema } from "../read";
import {
    DocsSectionSchema as WriteDocsSectionSchema,
    NavigationItemSchema as WriteNavigationItemSchema
} from "../write";

describe("collapsed schema", () => {
    it("write schemas accept collapsed: open-by-default", () => {
        const docsSection = WriteDocsSectionSchema.parse({
            title: "Section",
            items: [],
            collapsed: "open-by-default"
        });
        expect(docsSection.collapsed).toBe("open-by-default");

        const navItem = WriteNavigationItemSchema.parse({
            type: "section",
            title: "Section",
            items: [],
            collapsed: "open-by-default"
        });
        expect(navItem.type).toBe("section");
        if (navItem.type !== "section") {
            throw new Error("Expected section");
        }
        expect(navItem.collapsed).toBe("open-by-default");
    });

    it("read schemas accept collapsed: open-by-default", () => {
        const docsSection = ReadDocsSectionSchema.parse({
            urlSlug: "section",
            title: "Section",
            items: [],
            skipUrlSlug: false,
            collapsed: "open-by-default"
        });
        expect(docsSection.collapsed).toBe("open-by-default");

        const navItem = ReadNavigationItemSchema.parse({
            type: "section",
            urlSlug: "section",
            title: "Section",
            items: [],
            skipUrlSlug: false,
            collapsed: "open-by-default"
        });
        expect(navItem.type).toBe("section");
        if (navItem.type !== "section") {
            throw new Error("Expected section");
        }
        expect(navItem.collapsed).toBe("open-by-default");
    });

    it("db schemas accept collapsed: open-by-default", () => {
        const docsSection = DbDocsSectionSchema.parse({
            urlSlug: "section",
            title: "Section",
            items: [],
            skipUrlSlug: false,
            collapsed: "open-by-default"
        });
        expect(docsSection.collapsed).toBe("open-by-default");

        const navItem = DbNavigationItemSchema.parse({
            type: "section",
            urlSlug: "section",
            title: "Section",
            items: [],
            skipUrlSlug: false,
            collapsed: "open-by-default"
        });
        expect(navItem.type).toBe("section");
        if (navItem.type !== "section") {
            throw new Error("Expected section");
        }
        expect(navItem.collapsed).toBe("open-by-default");
    });
});
