import fs from "node:fs";
import path from "node:path";
import {
    dashboardContract,
    docsCacheContract,
    generatorCliContract,
    generatorsContract,
    generatorVersionsContract,
    libraryDocsContract,
    organizationContract,
    pdfExportContract
} from "@fern-api/fdr-sdk/orpc-client";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
});

// Uses oRPC contracts from @fern-api/fdr-sdk instead of server routers so that
// OpenAPI generation gets proper z.object() schemas (required for path params)
// while server routes can keep z.custom<>() for zero runtime validation.

const contractGroups: { prefix: string; contract: Record<string, unknown> }[] = [
    { prefix: "/v2/registry/docs", contract: organizationContract },
    { prefix: "/v2/registry/docs", contract: libraryDocsContract },
    { prefix: "/dashboard", contract: dashboardContract },
    { prefix: "/pdf-export", contract: pdfExportContract },
    { prefix: "/generators/cli", contract: generatorCliContract },
    { prefix: "/generators", contract: generatorsContract },
    { prefix: "/generators/versions", contract: generatorVersionsContract },
    { prefix: "/docs-cache", contract: docsCacheContract }
];

async function main() {
    const allPaths: Record<string, Record<string, unknown>> = {};

    for (const { prefix, contract } of contractGroups) {
        const spec = await generator.generate(contract, {
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
