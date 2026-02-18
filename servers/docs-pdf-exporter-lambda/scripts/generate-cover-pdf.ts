import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DocsPdfExporter } from "../src/exporter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
    const baseUrl = "http://localhost:3000";

    const outputDir = path.resolve(__dirname, "../output");
    await mkdir(outputDir, { recursive: true });

    const exporter = new DocsPdfExporter({
        maxRenderRetries: 4,
        renderTimeoutSeconds: 120,
        continueOnPageError: true,
        maxRenderConcurrency: 10,
        compression: {
            quality: "ebook",
            timeoutSeconds: 30,
            maxConcurrency: 5
        },
        logLevel: "debug",
        logFormat: "pretty",
        authToken: process.env.PDF_EXPORT_FERN_TOKEN
    });

    await exporter.start();
    const result = await exporter.generateCoverPdf(baseUrl);
    await exporter.stop();

    // Write output
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const outputPath = path.join(outputDir, `cover-export-${timestamp}.pdf`);
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
