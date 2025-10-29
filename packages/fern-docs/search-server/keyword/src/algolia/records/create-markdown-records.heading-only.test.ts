import { uniq } from "es-toolkit/array";

import type { BaseRecord } from "../types";
import { createMarkdownRecords } from "./create-markdown-records";

describe("createMarkdownRecords - heading-only records", () => {
    const baseRecord: BaseRecord = {
        objectID: "test-page",
        title: "Test Page",
        domain: "test.example.com",
        org_id: "test-org",
        canonicalPathname: "/test-page",
        pathname: "/test-page",
        breadcrumb: [],
        visible_by: [],
        authed: false
    };

    it("should create records for H1 headings without immediate content", () => {
        const markdown = `
# Product Fungibility

## Overview

Product fungibility allows you to set unified risk limits.

## Configuration

Some configuration details here.
`;

        const records = createMarkdownRecords({ base: baseRecord, markdown });

        const productFungibilityRecord = records.find((r) => r.title === "Product Fungibility");

        expect(productFungibilityRecord).toBeDefined();
        expect(productFungibilityRecord).toMatchObject({
            title: "Product Fungibility",
            content: undefined,
            level: "h1",
            page_position: 1,
            hash: "#product-fungibility"
        });
    });

    it("should create records for H2 headings without immediate content", () => {
        const markdown = `
# Introduction

Some intro content.

## Empty H2 Heading

### Nested H3 with Content

This H3 has content, but the H2 above it doesn't.
`;

        const records = createMarkdownRecords({ base: baseRecord, markdown });

        const emptyH2Record = records.find((r) => r.title === "Empty H2 Heading");

        expect(emptyH2Record).toBeDefined();
        expect(emptyH2Record).toMatchObject({
            title: "Empty H2 Heading",
            content: undefined,
            level: "h2",
            page_position: 1,
            hash: "#empty-h2-heading"
        });
    });

    it("should create records for multiple empty headings", () => {
        const markdown = `
# Main Title

## First Empty H2

### First Nested H3

### Second Nested H3

Both H3s above have no content, and neither does the H2.

## Second Empty H2

### Another Empty H3

#### Empty H4

All headings above are empty.
`;

        const records = createMarkdownRecords({ base: baseRecord, markdown });

        const headingOnlyRecords = records.filter(
            (r) => r.content === undefined && r.type === "markdown" && r.hash !== undefined
        );

        expect(headingOnlyRecords.length).toBeGreaterThanOrEqual(4);

        headingOnlyRecords.forEach((record) => {
            expect(record.page_position).toBe(1);
            expect(record.content).toBeUndefined();
            expect(record.hash).toBeDefined();
            expect(record.level).toMatch(/^h[1-6]$/);
        });
    });

    it("should use chunkIndex + 1 for page_position when content is chunked", () => {
        const largeContent = "A".repeat(60_000);

        const markdown = `
# Large Section

${largeContent}

## Another Section

Some more content.
`;

        const records = createMarkdownRecords({ base: baseRecord, markdown });

        const largeSectionRecords = records.filter((r) => r.title === "Large Section");

        expect(largeSectionRecords.length).toBeGreaterThan(1);

        const pagePositions = largeSectionRecords.map((r) => r.page_position).sort((a, b) => (a ?? 0) - (b ?? 0));
        expect(pagePositions).toEqual([1, 2]);
    }, 90000);

    it("should maintain hierarchy for heading-only records", () => {
        const markdown = `
# Top Level

## Section A

### Subsection A1

Content here.

### Subsection A2

No content here, but should still be indexed.
`;

        const records = createMarkdownRecords({ base: baseRecord, markdown });

        const subsectionA2Record = records.find((r) => r.title === "Subsection A2");

        expect(subsectionA2Record).toBeDefined();
        expect(subsectionA2Record?.hierarchy).toMatchObject({
            h0: { title: "Test Page" },
            h1: { id: "top-level", title: "Top Level" },
            h2: { id: "section-a", title: "Section A" },
            h3: { id: "subsection-a2", title: "Subsection A2" }
        });
    });

    it("should ensure all objectIDs are unique", () => {
        const markdown = `
# Section 1

## Subsection 1.1

### Empty H3

#### Empty H4

## Subsection 1.2

Content here.

# Section 2

More content.
`;

        const records = createMarkdownRecords({ base: baseRecord, markdown });

        const objectIDs = records.map((r) => r.objectID);
        const uniqueObjectIDs = uniq(objectIDs);

        expect(uniqueObjectIDs.length).toBe(objectIDs.length);
    });

    it("should handle the Tradovate Product Fungibility example", () => {
        const markdown = `
# User Assigns Custom Post-Trade Risk

A user can be allowed to set their own custom post-trade risk settings.

## Product Fungibility

### Overview

Product fungibility allows you to set unified risk limits across related products by using conversion ratios.

### Examples

For example:

1 E-mini S&P 500 Index (ES) = 10 Micro E-mini S&P 500 Index (MES)
`;

        const records = createMarkdownRecords({ base: baseRecord, markdown });

        const productFungibilityRecord = records.find((r) => r.title === "Product Fungibility");

        expect(productFungibilityRecord).toBeDefined();
        expect(productFungibilityRecord).toMatchObject({
            title: "Product Fungibility",
            content: undefined,
            level: "h2",
            page_position: 1,
            hash: "#product-fungibility"
        });

        expect(productFungibilityRecord?.hierarchy?.h1).toMatchObject({
            id: "user-assigns-custom-post-trade-risk",
            title: "User Assigns Custom Post-Trade Risk"
        });
    });
});
