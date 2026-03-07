// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { FernCliConfig } from "@/utils/fernCliConfig";

import type { TemplateFile } from "./generated-templates";
import { applySubstitutions, WORKFLOW_PATHS } from "./index";

const PROD_CONFIG: FernCliConfig = {
    npmPackage: "fern-api",
    cliCommand: "fern",
    docsDomain: "docs.buildwithfern.com"
};

const DEV_CONFIG: FernCliConfig = {
    npmPackage: "@fern-api/fern-api-dev",
    cliCommand: "fern-dev",
    docsDomain: "docs.dev.buildwithfern.com"
};

const PUBLISH_DOCS_WORKFLOW: TemplateFile = {
    path: ".github/workflows/publish-docs.yml",
    content: `name: publish-docs

on:
  push:
    branches:
      - main
  workflow_dispatch: # Allow manual/API trigger

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "lts/*"

      - name: Install Fern CLI tool
        uses: fern-api/setup-fern-cli@v1

      - name: Publish Docs
        env:
          FERN_TOKEN: \${{ secrets.FERN_TOKEN }}
        run: fern generate --docs
`
};

const CHECK_WORKFLOW: TemplateFile = {
    path: ".github/workflows/check.yml",
    content: `name: fern-check

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "lts/*"

      - name: Install Fern CLI tool
        uses: fern-api/setup-fern-cli@v1

      - name: Check API is valid
        run: fern check
`
};

const PREVIEW_DOCS_WORKFLOW: TemplateFile = {
    path: ".github/workflows/preview-docs.yml",
    content: `name: preview-docs

on: pull_request

jobs:
  run:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "lts/*"

      - name: Install Fern CLI tool
        uses: fern-api/setup-fern-cli@v1

      - name: Generate preview URL
        id: generate-docs
        env:
          FERN_TOKEN: \${{ secrets.FERN_TOKEN }}
        run: |
          OUTPUT=$(fern generate --docs --preview 2>&1) || true
          echo "$OUTPUT"
          URL=$(echo "$OUTPUT" | grep -oP 'Published docs to \\K.*(?= \\()')
          echo "Preview URL: $URL"
          echo "🌿 Preview your docs: $URL" > preview_url.txt

      - name: Comment URL in PR
        uses: thollander/actions-comment-pull-request@v2.4.3
        with:
          filePath: preview_url.txt
`
};

const NON_WORKFLOW_FILE: TemplateFile = {
    path: "fern/docs.yml",
    content: `instances:
  - url: plantstore.docs.buildwithfern.com
`
};

describe("applySubstitutions", () => {
    describe("prod config", () => {
        it("does not modify workflow files in prod mode", () => {
            const result = applySubstitutions([PUBLISH_DOCS_WORKFLOW], PROD_CONFIG);
            expect(result[0]).toBe(PUBLISH_DOCS_WORKFLOW);
        });

        it("keeps setup-fern-cli action in publish-docs workflow", () => {
            const result = applySubstitutions([PUBLISH_DOCS_WORKFLOW], PROD_CONFIG);
            expect(result[0].content).toContain("uses: fern-api/setup-fern-cli@v1");
            expect(result[0].content).toContain("uses: actions/setup-node@v4");
        });

        it("keeps setup-fern-cli action in check workflow", () => {
            const result = applySubstitutions([CHECK_WORKFLOW], PROD_CONFIG);
            expect(result[0].content).toContain("uses: fern-api/setup-fern-cli@v1");
            expect(result[0].content).toContain("run: fern check");
        });

        it("keeps setup-fern-cli action in preview-docs workflow", () => {
            const result = applySubstitutions([PREVIEW_DOCS_WORKFLOW], PROD_CONFIG);
            expect(result[0].content).toContain("uses: fern-api/setup-fern-cli@v1");
            expect(result[0].content).toContain("$(fern generate");
        });

        it("does not modify non-workflow files", () => {
            const result = applySubstitutions([NON_WORKFLOW_FILE], PROD_CONFIG);
            expect(result[0]).toBe(NON_WORKFLOW_FILE);
        });

        it("does not contain npm install -g in prod workflows", () => {
            const result = applySubstitutions(
                [PUBLISH_DOCS_WORKFLOW, CHECK_WORKFLOW, PREVIEW_DOCS_WORKFLOW],
                PROD_CONFIG
            );
            for (const file of result) {
                expect(file.content).not.toContain("npm install -g");
            }
        });
    });

    describe("dev config", () => {
        it("replaces setup-fern-cli action with npm install -g for dev package in publish-docs", () => {
            const result = applySubstitutions([PUBLISH_DOCS_WORKFLOW], DEV_CONFIG);
            expect(result[0].content).toContain("npm install -g @fern-api/fern-api-dev");
            expect(result[0].content).not.toContain("uses: fern-api/setup-fern-cli@v1");
            expect(result[0].content).not.toContain("uses: actions/setup-node@v4");
        });

        it("replaces fern command with fern-dev in publish-docs", () => {
            const result = applySubstitutions([PUBLISH_DOCS_WORKFLOW], DEV_CONFIG);
            expect(result[0].content).toContain("run: fern-dev generate --docs");
            expect(result[0].content).not.toMatch(/run: fern generate/);
        });

        it("replaces setup-fern-cli action with npm install -g for dev package in check workflow", () => {
            const result = applySubstitutions([CHECK_WORKFLOW], DEV_CONFIG);
            expect(result[0].content).toContain("npm install -g @fern-api/fern-api-dev");
            expect(result[0].content).not.toContain("uses: fern-api/setup-fern-cli@v1");
            expect(result[0].content).not.toContain("uses: actions/setup-node@v4");
        });

        it("replaces fern command with fern-dev in check workflow", () => {
            const result = applySubstitutions([CHECK_WORKFLOW], DEV_CONFIG);
            expect(result[0].content).toContain("run: fern-dev check");
            expect(result[0].content).not.toMatch(/run: fern check/);
        });

        it("replaces setup-fern-cli action with npm install -g for dev package in preview-docs", () => {
            const result = applySubstitutions([PREVIEW_DOCS_WORKFLOW], DEV_CONFIG);
            expect(result[0].content).toContain("npm install -g @fern-api/fern-api-dev");
            expect(result[0].content).not.toContain("uses: fern-api/setup-fern-cli@v1");
            expect(result[0].content).not.toContain("uses: actions/setup-node@v4");
        });

        it("replaces $(fern with $(fern-dev in preview-docs", () => {
            const result = applySubstitutions([PREVIEW_DOCS_WORKFLOW], DEV_CONFIG);
            expect(result[0].content).toContain("$(fern-dev generate");
            expect(result[0].content).not.toMatch(/\$\(fern generate/);
        });

        it("replaces docs.buildwithfern.com with dev domain in non-workflow files", () => {
            const result = applySubstitutions([NON_WORKFLOW_FILE], DEV_CONFIG);
            expect(result[0].content).toContain("docs.dev.buildwithfern.com");
            expect(result[0].content).not.toContain("docs.buildwithfern.com");
        });

        it("does not modify non-workflow file CLI references", () => {
            const result = applySubstitutions([NON_WORKFLOW_FILE], DEV_CONFIG);
            expect(result[0].content).not.toContain("npm install");
            expect(result[0].content).not.toContain("fern-dev");
        });
    });

    describe("WORKFLOW_PATHS", () => {
        it("contains all three expected workflow paths", () => {
            expect(WORKFLOW_PATHS.has(".github/workflows/check.yml")).toBe(true);
            expect(WORKFLOW_PATHS.has(".github/workflows/preview-docs.yml")).toBe(true);
            expect(WORKFLOW_PATHS.has(".github/workflows/publish-docs.yml")).toBe(true);
        });
    });
});
