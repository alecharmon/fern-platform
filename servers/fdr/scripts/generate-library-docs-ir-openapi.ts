import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { createLibraryDocsIRRouter } from "../src/controllers/docs/v2/library-docs-ir/libraryDocsIRRouter";

const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
});

async function main() {
    const router = createLibraryDocsIRRouter();

    const spec = await generator.generate(router, {
        info: {
            title: "Library Docs IR API",
            version: "0.0.0",
            description: "OpenAPI spec for the Library Documentation Intermediate Representation (IR) types."
        }
    });

    const outputPath = path.resolve(import.meta.dirname, "..", "library-docs-ir-openapi.json");
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2) + "\n");
    execSync(`pnpm biome format --write ${outputPath}`, { stdio: "inherit" });
    process.stdout.write(`Library Docs IR OpenAPI spec written to ${outputPath}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(String(err) + "\n");
    process.exit(1);
});
