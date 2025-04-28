import { writeFile } from "fs/promises";
import { join } from "path";
import tmp from "tmp-promise";
import { expect, test } from "vitest";

import { createTurbopufferRecords } from "../../../../search-server/src/turbopuffer/records/create-turbopuffer-records";

test("check generated turbopuffer index", { timeout: 60000 }, async () => {
  const fdrJson = join(__dirname, "fixtures", "buildwithfern.com", "fdr.json");

  const { pages, apis, root } = require(fdrJson);
  const domain = "buildwithfern.com";
  const unvectorizedRecords = await createTurbopufferRecords({
    root,
    domain,
    org_id: "fern",
    pages,
    apis,
    authed: () => false,
    splitText: (text: string) => Promise.resolve([text]),
  });

  const file = await tmp.file();
  const json = JSON.stringify(unvectorizedRecords, undefined, 2);
  await writeFile(file.path, json);

  await expect(json).toMatchFileSnapshot(
    join(__dirname, "__snapshots__", `${domain}.json`)
  );
});
