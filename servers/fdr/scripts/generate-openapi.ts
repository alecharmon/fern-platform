import fs from "node:fs";
import path from "node:path";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { createGetOrganizationForUrlRouter } from "../src/controllers/docs/v2/getOrganizationForUrlRouter";

const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
});

const router = createGetOrganizationForUrlRouter(undefined as never);

async function main() {
    const spec = await generator.generate(router, {
        info: {
            title: "FDR API",
            version: "0.0.0"
        }
    });

    const outputPath = path.resolve(import.meta.dirname, "..", "openapi.json");
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2) + "\n");
    process.stdout.write(`OpenAPI spec written to ${outputPath}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(String(err) + "\n");
    process.exit(1);
});
