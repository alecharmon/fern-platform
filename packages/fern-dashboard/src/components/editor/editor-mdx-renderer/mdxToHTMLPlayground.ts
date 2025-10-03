#!/usr/bin/env node
import { mdxToAST, mdxToHtml } from "@fern-docs/mdx";

// Sample MDX content for testing
const sampleMDX = `
![Fern Logo](/docs/assets/Logo.png)
`;

// Function to pretty print HTML with basic formatting
function prettyPrintHTML(html: string): string {
    // Basic HTML formatting - add newlines after certain tags
    return html
        .replace(/></g, ">\n<")
        .replace(/(<\/[^>]+>)(<[^/])/g, "$1\n$2")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n");
}

// Function to analyze HTML structure
function analyzeHTML(html: string) {
    const customElementMatches = html.match(/<custom-element-v2[^>]*>/g) || [];
    const regularElementMatches = html.match(/<[^/!][^>]*>/g) || [];
    const fveDataIdMatches = html.match(/fve-data-id="[^"]*"/g) || [];
    const fveMdxB64Matches = html.match(/fve-mdx-b64="[^"]*"/g) || [];

    return {
        totalElements: regularElementMatches.length,
        customElements: customElementMatches.length,
        elementsWithDataId: fveDataIdMatches.length,
        elementsWithMdxB64: fveMdxB64Matches.length,
        customElementMatches,
        fveDataIdMatches: fveDataIdMatches.slice(0, 5) // Show first 5
    };
}

// Function to decode and display some base64 MDX content
function decodeSampleMdxContent(html: string, maxSamples = 3) {
    const matches = html.match(/fve-mdx-b64="([^"]*)"/g) || [];
    const samples: { id: string; content: string }[] = [];

    for (let i = 0; i < Math.min(matches.length, maxSamples); i++) {
        const match = matches[i];
        const base64Content = match?.match(/fve-mdx-b64="([^"]*)"/)?.[1];
        if (base64Content) {
            try {
                const decoded = Buffer.from(base64Content, "base64").toString("utf-8");
                samples.push({
                    id: `sample-${i + 1}`,
                    content: decoded.length > 100 ? decoded.substring(0, 100) + "..." : decoded
                });
            } catch (error) {
                samples.push({
                    id: `sample-${i + 1}`,
                    content: `[Error decoding: ${error}]`
                });
            }
        }
    }

    return samples;
}

// Function to run the playground
function runPlayground() {
    console.log("🎮 MDX to HTML Playground");
    console.log("=========================\n");

    console.log("📝 Sample MDX Input:");
    console.log("---");
    console.log(sampleMDX);
    console.log("---\n");

    console.log("🔍 Processing with mdxToHtml...");
    console.log("===============================");

    try {
        // Test basic conversion
        const result = mdxToHtml(sampleMDX);

        console.log("✅ Conversion successful!\n");

        // Display frontmatter
        console.log("📋 Extracted Frontmatter:");
        console.log(JSON.stringify(result.frontmatter, null, 2));
        console.log();

        if (result.originalFrontmatter) {
            console.log("📄 Original Frontmatter YAML:");
            console.log(result.originalFrontmatter);
            console.log();
        }

        // Analyze HTML structure
        console.log("🔍 HTML Analysis:");
        const analysis = analyzeHTML(result.html);
        console.log(`  Total HTML Elements: ${analysis.totalElements}`);
        console.log(`  Custom Elements: ${analysis.customElements}`);
        console.log(`  Elements with Data ID: ${analysis.elementsWithDataId}`);
        console.log(`  Elements with MDX Base64: ${analysis.elementsWithMdxB64}`);
        console.log();

        // Show some sample decoded content
        if (analysis.elementsWithMdxB64 > 0) {
            console.log("📦 Sample Encoded MDX Content:");
            const samples = decodeSampleMdxContent(result.html);
            samples.forEach((sample) => {
                console.log(`  ${sample.id}: ${sample.content}`);
            });
            console.log();
        }

        // Display formatted HTML (truncated for readability)
        console.log("🌐 Generated HTML (first 2000 characters):");
        console.log("---");
        const formattedHTML = prettyPrintHTML(result.html);
        console.log(formattedHTML.substring(0, 2000));
        if (formattedHTML.length > 2000) {
            console.log("...\n[HTML truncated for readability]");
        }
        console.log("---\n");

        // Test with different options
        console.log("🧪 Testing with Custom Options:");
        console.log("===============================");

        // Test treating code as custom element
        const customResult = mdxToHtml(sampleMDX, {
            treatAsCustomElement: ["code"]
        });
        const customAnalysis = analyzeHTML(customResult.html);
        console.log(`With 'code' as custom element:`);
        console.log(`  Custom Elements: ${customAnalysis.customElements} (vs ${analysis.customElements} default)`);
        console.log();

        // Test AST parsing separately
        console.log("🌳 AST Analysis:");
        const { mdast } = mdxToAST(sampleMDX);
        const nodeTypes = new Set<string>();

        function collectNodeTypes(node: any) {
            if (node && typeof node === "object" && node.type) {
                nodeTypes.add(node.type);
            }
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(collectNodeTypes);
            }
        }

        collectNodeTypes(mdast);
        console.log(`  Found node types: ${Array.from(nodeTypes).sort().join(", ")}`);
        console.log(`  Total root children: ${mdast.children?.length || 0}`);
    } catch (error) {
        console.error("❌ Error processing MDX:", error);
        if (error instanceof Error) {
            console.error("Stack trace:", error.stack);
        }
    }
}

// Interactive mode function
function interactiveMode() {
    const readline = require("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("\n🔄 Interactive Mode");
    console.log("Enter your MDX content (type 'exit' to quit, 'sample' for sample content):");
    console.log("Press Enter twice to convert your input.\n");

    let inputBuffer = "";
    let emptyLineCount = 0;

    rl.on("line", (line: string) => {
        if (line.trim() === "exit") {
            rl.close();
            return;
        }

        if (line.trim() === "sample") {
            inputBuffer = sampleMDX;
            emptyLineCount = 2; // Trigger processing
        } else if (line.trim() === "") {
            emptyLineCount++;
        } else {
            inputBuffer += (inputBuffer ? "\n" : "") + line;
            emptyLineCount = 0;
        }

        if (emptyLineCount >= 2 && inputBuffer.trim()) {
            console.log("\n🔍 Converting your MDX to HTML...\n");

            try {
                const result = mdxToHtml(inputBuffer);

                console.log("✅ Conversion successful!");
                console.log("\n📋 Frontmatter:");
                console.log(JSON.stringify(result.frontmatter, null, 2));

                console.log("\n🔍 HTML Analysis:");
                const analysis = analyzeHTML(result.html);
                console.log(`  Total Elements: ${analysis.totalElements}`);
                console.log(`  Custom Elements: ${analysis.customElements}`);
                console.log(`  Elements with Data ID: ${analysis.elementsWithDataId}`);

                console.log("\n🌐 Generated HTML:");
                console.log("---");
                console.log(prettyPrintHTML(result.html));
                console.log("---");
            } catch (error) {
                console.error("❌ Error converting MDX:", error);
            }

            inputBuffer = "";
            emptyLineCount = 0;
            console.log("\nEnter more MDX content (or 'exit' to quit):\n");
        }
    });

    rl.on("close", () => {
        console.log("\n👋 Goodbye!");
        process.exit(0);
    });
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes("--interactive") || args.includes("-i")) {
        runPlayground();
        interactiveMode();
    } else {
        runPlayground();

        console.log("\n💡 Tip: Run with --interactive or -i flag for interactive mode!");
        console.log("Example: node mdxToHTMLPlayground.ts --interactive");
    }
}

export { runPlayground, prettyPrintHTML, analyzeHTML };
