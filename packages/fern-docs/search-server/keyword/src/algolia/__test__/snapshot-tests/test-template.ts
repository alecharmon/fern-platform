import { type DocsV2Read, FernNavigation } from "@fern-api/fdr-sdk";
import fs from "fs";
import path from "path";
import { createAlgoliaRecords } from "../../records/create-algolia-records";

const fixturesDir = path.join(__dirname, "../../../../../../../fdr-sdk/src/__test__/fixtures");

export function readFixture(fixture: string): DocsV2Read.LoadDocsForUrlResponse {
    const fixturePath = path.join(fixturesDir, `${fixture}.json`);
    const content = fs.readFileSync(fixturePath, "utf-8");
    return JSON.parse(content) as DocsV2Read.LoadDocsForUrlResponse;
}

export function runFixtureTest(fixtureName: string): void {
    it("should generate valid algolia records", async () => {
        const fixture = readFixture(fixtureName);
        const root = FernNavigation.utils.toRootNode(fixture);
        const apis = FernNavigation.utils.toApis(fixture);
        const pages = FernNavigation.utils.toPages(fixture);

        const filteredPages: Record<string, string> = {};
        for (const [key, value] of Object.entries(pages)) {
            if (value != null) {
                filteredPages[key] = value;
            }
        }

        const { records, tooLarge } = await createAlgoliaRecords({
            root,
            domain: "test.com",
            org_id: "test",
            pages: filteredPages,
            apis
        });

        expect(tooLarge.length).toBe(0);

        for (const record of records) {
            if (record.description != null) {
                expect(record.description.length).toBeLessThanOrEqual(50_000);
            }

            if (record.type === "markdown" && record.content != null) {
                expect(record.content.length).toBeLessThanOrEqual(50_000);
            }
        }

        await expect(JSON.stringify(records)).toMatchFileSnapshot(
            path.join(__dirname, "..", "__snapshots__", `${fixtureName}.test.ts.json`)
        );
    }, 120_000);
}
