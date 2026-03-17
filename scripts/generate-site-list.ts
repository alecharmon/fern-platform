#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const csvPath = resolve(__dirname, "../playwright/checks/sites.csv");
const outputPath = resolve(__dirname, "../playwright/checks/sites.ts");

const csv = readFileSync(csvPath, "utf-8");
const sites = csv
    .split("\n")
    .map((line) => line.split(",")[0]?.trim())
    .filter((domain): domain is string => !!domain && domain.length > 0);

const content = `// Auto-generated from sites.csv — do not edit manually.
// Regenerate with: pnpm tsx scripts/generate-site-list.ts

export const SITES: string[] = ${JSON.stringify(sites, null, 4)};
`;

writeFileSync(outputPath, content, "utf-8");
