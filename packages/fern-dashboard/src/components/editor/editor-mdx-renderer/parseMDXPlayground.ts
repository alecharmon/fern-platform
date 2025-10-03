#!/usr/bin/env node
import { editableComponents, parseMDX, richTextComponents } from "./parse";

// Sample MDX content for testing
const sampleMDX = `
Welcome!

![Fern Logo](/docs/assets/Logo.png)

## Getting Started


<CardGroup>
  <Card 
    title="API Reference" 
    icon="fa-solid fa-code" 
    href="/api-reference" 
  />
  <Card
    title="Slack Community"
    icon="fa-brands fa-slack"
    href="https://join.slack.com/t/fern-community/shared_invite/zt-2q7ev4mki-mhO5anKslwRowp4oExWf4A"
  />
  <Card
    title="Blog"
    icon="fa-solid fa-signal"
    href="https://blog.buildwithfern.com"
  />
  <Card
    title="SOC 2 Audited"
    icon="fa-solid fa-shield-halved"
    href="https://security.buildwithfern.com"
  />
</CardGroup>
`;

// Function to pretty print the parsed results
function prettyPrintParsedElement(element: any, indent = 0): string {
    const spaces = "  ".repeat(indent);

    if (element.type === "terminalElement") {
        return `${spaces}Terminal Element:\n${spaces}  MDX: ${JSON.stringify(element.originalMdx)}`;
    }

    if (element.type === "jsxElement") {
        const { name, keyedAttributes, expressionAttributes, children, contentDraggingDisabled } = element.value;

        let result = `${spaces}JSX Element: ${name}\n`;
        result += `${spaces}  Content Dragging Disabled: ${contentDraggingDisabled}\n`;

        if (Object.keys(keyedAttributes).length > 0) {
            result += `${spaces}  Keyed Attributes:\n`;
            for (const [key, value] of Object.entries(keyedAttributes)) {
                result += `${spaces}    ${key}: ${JSON.stringify(value)}\n`;
            }
        }

        if (expressionAttributes.length > 0) {
            result += `${spaces}  Expression Attributes: ${expressionAttributes.length}\n`;
        }

        result += `${spaces}  Children Type: ${children.type}\n`;
        if (children.type !== "DISALLOWED") {
            result += `${spaces}  Children MDX: ${JSON.stringify((children as any).childrenMdx)}\n`;
        }

        return result;
    }

    return `${spaces}Unknown element type: ${element.type}`;
}

// Function to run the playground
function runPlayground() {
    console.log("🎮 MDX Parser Playground");
    console.log("========================\n");

    console.log("📋 Available Components:");
    console.log("Rich Text Components:", richTextComponents.join(", "));
    console.log("All Editable Components:", editableComponents.join(", "));
    console.log();

    console.log("📝 Sample MDX Input:");
    console.log("---");
    console.log(sampleMDX);
    console.log("---\n");

    console.log("🔍 Parsing Results:");
    console.log("==================");

    try {
        const parsed = parseMDX(sampleMDX);

        console.log(`Found ${parsed.length} elements:\n`);

        parsed.forEach((element, index) => {
            console.log(`Element ${index + 1}:`);
            console.log(prettyPrintParsedElement(element, 1));
            console.log();
        });

        // Summary statistics
        const terminalCount = parsed.filter((el) => el.type === "terminalElement").length;
        const jsxCount = parsed.filter((el) => el.type === "jsxElement").length;
        const richTextCount = parsed.filter(
            (el) => el.type === "jsxElement" && el.value.children.type === "RICH_TEXT"
        ).length;

        console.log("📊 Summary:");
        console.log(`  Terminal Elements: ${terminalCount}`);
        console.log(`  JSX Elements: ${jsxCount}`);
        console.log(`  Rich Text Elements: ${richTextCount}`);
    } catch (error) {
        console.error("❌ Error parsing MDX:", error);
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
    console.log("Press Enter twice to parse your input.\n");

    let inputBuffer = "";
    let emptyLineCount = 0;

    rl.on("line", (line: string) => {
        if (line.trim() === "exit") {
            rl.close();
            return;
        }

        if (line.trim() === "sample") {
            inputBuffer = sampleMDX;
            emptyLineCount = 2; // Trigger parsing
        } else if (line.trim() === "") {
            emptyLineCount++;
        } else {
            inputBuffer += (inputBuffer ? "\n" : "") + line;
            emptyLineCount = 0;
        }

        if (emptyLineCount >= 2 && inputBuffer.trim()) {
            console.log("\n🔍 Parsing your input...\n");

            try {
                const parsed = parseMDX(inputBuffer);
                parsed.forEach((element, index) => {
                    console.log(`Element ${index + 1}:`);
                    console.log(prettyPrintParsedElement(element, 1));
                    console.log();
                });
            } catch (error) {
                console.error("❌ Error parsing MDX:", error);
            }

            inputBuffer = "";
            emptyLineCount = 0;
            console.log("Enter more MDX content (or 'exit' to quit):\n");
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
        console.log("Example: node playground.ts --interactive");
    }
}

export { runPlayground, prettyPrintParsedElement };
