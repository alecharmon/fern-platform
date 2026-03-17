import { expect, test } from "@playwright/test";

import { SITES } from "./sites";

test("all customer production sites return 200", async ({ request }) => {
    const failures: string[] = [];

    for (const site of SITES) {
        await test.step(`check ${site}`, async () => {
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
        });
    }

    expect(failures, `${failures.length} site(s) down:\n${failures.join("\n")}`).toHaveLength(0);
});
