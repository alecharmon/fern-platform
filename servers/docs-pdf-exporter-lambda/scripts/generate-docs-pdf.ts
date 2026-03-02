import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DocsPdfExporter } from "../src/exporter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
    const docsUrl = "http://localhost:3000";
    const productId = process.env.PDF_EXPORT_PRODUCT ?? undefined;
    const versionId = process.env.PDF_EXPORT_VERSION ?? undefined;

    const outputDir = path.resolve(__dirname, "../output");
    await mkdir(outputDir, { recursive: true });

    const exporter = new DocsPdfExporter({
        maxRenderRetries: 4,
        renderTimeoutSeconds: 120,
        continueOnPageError: true,
        maxRenderConcurrency: 25,
        compression: {
            quality: "ebook",
            timeoutSeconds: 30
        },
        logLevel: "debug",
        logFormat: "pretty",
        authToken: process.env.PDF_EXPORT_FERN_TOKEN,
        stubContentPages: true
    });

    await exporter.start();
    const result = await exporter.generateDocsPdf(
        {
            docsUrl,
            productId,
            versionId
        },
        {
            coverSubtitle: "Complete documentation for developers, technical teams, and partners.",
            footerRightTemplate: "Page {pageIndex} of {totalPages}"
        }
    );
    await exporter.stop();

    // Report any page errors
    if (result.pageErrors.length > 0) {
        // biome-ignore lint/suspicious/noConsole: local CLI output is intentional
        console.warn(`⚠️  ${result.pageErrors.length} page(s) failed to render:`);
        for (const err of result.pageErrors) {
            // biome-ignore lint/suspicious/noConsole: local CLI output is intentional
            console.warn(`   - ${err.slug}: ${err.message}`);
        }
    }

    // Write output
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const outputPath = path.join(outputDir, `docs-export-${timestamp}.pdf`);
    await writeFile(outputPath, result.pdfBytes);

    // biome-ignore lint/suspicious/noConsole: local CLI output is intentional
    console.log(`✅ Wrote PDF to: ${outputPath}`);
}

void main()
    .then(() => {
        // biome-ignore lint/suspicious/noConsole: local CLI output is intentional
        console.log("✅ PDF generated successfully!");
        process.exit(0);
    })
    .catch((error) => {
        // biome-ignore lint/suspicious/noConsole: local CLI output is intentional
        console.error("❌ Error generating PDF:", error);
        process.exit(1);
    });
