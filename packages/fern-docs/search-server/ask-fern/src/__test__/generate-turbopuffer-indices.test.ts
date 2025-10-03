import { mapValues } from "es-toolkit/object";
import { readdir } from "fs/promises";
import { writeFile } from "fs/promises";
import { join } from "path";
import tmp from "tmp-promise";
import { expect, test } from "vitest";

import { ApiDefinition, DocsV1Read, FernNavigation } from "@fern-api/fdr-sdk";

import { createTurbopufferRecords } from "../turbopuffer/records/create-turbopuffer-records";

test("Check generated turbopuffer indices", { timeout: 60000 }, async () => {
    const fixturesDir = join(__dirname, "fixtures");
    const domains = await readdir(fixturesDir);

    for (const domain of domains) {
        const definitionPath = join(fixturesDir, domain, "definition.json");
        const { payload } = require(definitionPath);

        const root = FernNavigation.utils.toRootNode(payload);

        const pages = retrieveMarkdownFromPages(payload.definition.pages);

        const apis = {
            ...mapValues(payload.definition.apis, (api) =>
                ApiDefinition.ApiDefinitionV1ToLatest.from(api, {
                    useJavaScriptAsTypeScript: payload.useJavaScriptAsTypeScript ?? false,
                    alwaysEnableJavaScriptFetch: payload.alwaysEnableJavaScriptFetch ?? false,
                    usesApplicationJsonInFormDataValue: payload.usesApplicationJsonInFormDataValue ?? false
                }).migrate()
            ),
            ...payload.definition.apisV2
        };

        const unvectorizedRecords = await createTurbopufferRecords({
            root,
            domain,
            pages,
            apis,
            authed: () => false,
            splitText: (text: string) => Promise.resolve([text])
        });

        const file = await tmp.file();
        const json = JSON.stringify(unvectorizedRecords, undefined, 2);

        await writeFile(file.path, json);

        await expect(json).toMatchFileSnapshot(join(__dirname, "__snapshots__", `${domain}.json`));
    }
});

function retrieveMarkdownFromPages(pages: Record<FernNavigation.PageId, DocsV1Read.PageContent>) {
    return mapValues(pages, (page) => page.markdown);
}
