import { expect, test } from "@playwright/test";

import { SITES } from "./sites";

const BATCH_SIZE = 25;

const IGNORED_SITES = new Set(["developer.hellosign.com"]);

test("all customer production sites return 200", async ({ request }) => {
    test.setTimeout(5 * 60_000);

    const failures: string[] = [];
    const sites = SITES.filter((site) => !IGNORED_SITES.has(site));

    for (let i = 0; i < sites.length; i += BATCH_SIZE) {
        const batch = sites.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map((site) =>
                test.step(`check ${site}`, async () => {
                    try {
                        const resp = await request.get(`https://${site}`, {
                            timeout: 15_000,
                            maxRedirects: 5
                        });
                        if (resp.status() !== 200) {
                            failures.push(`${site}: status ${resp.status()}`);
                        }
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        failures.push(`${site}: ${msg}`);
                    }
                })
            )
        );
    }

    expect(failures, `${failures.length} site(s) down:\n${failures.join("\n")}`).toHaveLength(0);
});
