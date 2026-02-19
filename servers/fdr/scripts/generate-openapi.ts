import fs from "node:fs";
import path from "node:path";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { createDashboardRouter } from "../src/controllers/dashboard/getDashboardRouter";
import { createLibraryDocsRouter } from "../src/controllers/docs/v2/getLibraryDocsRouter";
import { createGetOrganizationForUrlRouter } from "../src/controllers/docs/v2/getOrganizationForUrlRouter";
import { createDocsCacheRouter } from "../src/controllers/docs-cache/docsCacheRouter";
import { createCliRouter } from "../src/controllers/generators/cliRouter";
import { createGeneratorsRootRouter } from "../src/controllers/generators/generatorsRootRouter";
import { createGeneratorVersionsRouter } from "../src/controllers/generators/generatorVersionsRouter";
import { createPdfExportRouter } from "../src/controllers/pdf-export";

const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
});

// TODO: The following routers are excluded because they transitively import
// workspace packages (@fern-api/fdr-sdk, @fern-api/github) whose dist files
// are not available in CI. They should be added once the build pipeline is fixed:
//   - createSnippetsForSdkRouter (src/controllers/snippets/createSnippetsForSdkRouter.ts) -> /snippets prefix
//   - createSnippetsRouter (src/controllers/snippets/createSnippetsRouter.ts) -> /snippets prefix
//   - createTemplatesRouter (src/controllers/snippets/createTemplatesRouter.ts) -> /snippet-template prefix
//   - createGitRouter (src/controllers/git/gitRouter.ts) -> /generators/github prefix
//   - createTokensRouter (src/controllers/tokens/tokensRouter.ts) -> /tokens prefix
//   - createComputeSemanticVersionRouter (src/controllers/sdk/computeSemanticVersionRouter.ts) -> /sdks prefix

const routerGroups: { prefix: string; router: Record<string, unknown> }[] = [
    { prefix: "/v2/registry/docs", router: createGetOrganizationForUrlRouter(undefined as never) },
    { prefix: "/v2/registry/docs", router: createLibraryDocsRouter(undefined as never) },
    { prefix: "/dashboard", router: createDashboardRouter(undefined as never) },
    { prefix: "/pdf-export", router: createPdfExportRouter(undefined as never) },
    { prefix: "/generators/cli", router: createCliRouter(undefined as never) },
    { prefix: "/generators", router: createGeneratorsRootRouter(undefined as never) },
    { prefix: "/generators/versions", router: createGeneratorVersionsRouter(undefined as never) },
    { prefix: "/docs-cache", router: createDocsCacheRouter(undefined as never) }
];

async function main() {
    const allPaths: Record<string, Record<string, unknown>> = {};

    for (const { prefix, router } of routerGroups) {
        const spec = await generator.generate(router, {
            info: { title: "temp", version: "0.0.0" }
        });

        for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
            const fullPath = routePath === "/" ? prefix : prefix + routePath;
            if (allPaths[fullPath] != null) {
                allPaths[fullPath] = { ...allPaths[fullPath], ...(pathItem as Record<string, unknown>) };
            } else {
                allPaths[fullPath] = pathItem as Record<string, unknown>;
            }
        }
    }

    const finalSpec = {
        info: {
            title: "FDR API",
            version: "0.0.0"
        },
        openapi: "3.1.1",
        paths: allPaths
    };

    const outputPath = path.resolve(import.meta.dirname, "..", "openapi.json");
    fs.writeFileSync(outputPath, JSON.stringify(finalSpec, null, 2) + "\n");
    process.stdout.write(`OpenAPI spec written to ${outputPath}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(String(err) + "\n");
    process.exit(1);
});
