import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DocsPdfGenerator } from "../generator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
    const baseUrl = "http://localhost:3000";

    const outputDir = path.resolve(__dirname, "../../output");
    await mkdir(outputDir, { recursive: true });

    const generator = new DocsPdfGenerator({
        maxRenderRetries: 5,
        renderTimeoutSeconds: 240,
        authToken: process.env.FERN_TOKEN
    });

    await generator.start();
    const result = await generator.generateCoverPdf(baseUrl);
    await generator.stop();

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
