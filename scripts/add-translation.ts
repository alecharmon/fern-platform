#!/usr/bin/env tsx

/**
 * Script to add a new translation constant to the i18n package.
 * Usage: pnpm tsx scripts/add-translation.ts <key>
 * Example: pnpm tsx scripts/add-translation.ts auth.newField
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_DIR = path.join(__dirname, "..", "packages", "commons", "i18n");
const TYPES_FILE = path.join(I18N_DIR, "src", "types.ts");
const LOCALES_DIR = path.join(I18N_DIR, "src", "locales");

const LOCALES = ["de", "el", "en", "es", "fr", "it", "ja", "ko", "no", "pl", "pt", "ru", "sv", "tr", "zh"];

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        throw new Error("Error: Missing translation key argument");
    }

    const translationKey = args[0];
    const parts = translationKey.split(".");

    if (parts.length < 2) {
        throw new Error("Error: Translation key must have at least two parts (e.g., auth.newField)");
    }

    const category = parts[0];
    const key = parts.slice(1).join(".");
    const fieldName = parts[parts.length - 1];

    // Step 1: Update types.ts
    updateTypesFile(category, fieldName);

    // Step 2: Update all locale files
    updateLocaleFiles(category, key, fieldName);
}

function updateTypesFile(category: string, fieldName: string) {
    let content = fs.readFileSync(TYPES_FILE, "utf-8");

    // Find the category section
    const categoryRegex = new RegExp(`(\\s+${category}:\\s*\\{[^}]*?)(\\s+\\};)`, "s");
    const match = content.match(categoryRegex);

    if (!match) {
        throw new Error(`Error: Could not find category "${category}" in types.ts`);
    }

    // Check if the field already exists
    const fieldRegex = new RegExp(`${fieldName}:\\s*string;`);
    if (fieldRegex.test(match[1])) {
        return;
    }

    // Add the new field before the closing brace, ensuring it's on a new line
    // Remove any trailing content on the last line before the closing brace
    const categoryContent = match[1];
    const closingBrace = match[2];

    // Ensure the last line ends properly before adding new field
    const trimmedContent = categoryContent.trimEnd();
    const newField = `\n        ${fieldName}: string;`;
    const updated = content.replace(categoryRegex, `${trimmedContent}${newField}${closingBrace}`);

    fs.writeFileSync(TYPES_FILE, updated, "utf-8");
}

function updateLocaleFiles(category: string, key: string, fieldName: string) {
    for (const locale of LOCALES) {
        const localeFile = path.join(LOCALES_DIR, locale, "common.json");

        if (!fs.existsSync(localeFile)) {
            continue;
        }

        try {
            const content = fs.readFileSync(localeFile, "utf-8");
            const data = JSON.parse(content);

            if (!data[category]) {
                continue;
            }

            // Check if the field already exists
            if (data[category][key]) {
                continue;
            }

            // Add the new field with a stub value
            const stubValue = locale === "en" ? `TODO: ${fieldName}` : `[${locale.toUpperCase()}] TODO: ${fieldName}`;

            data[category][key] = stubValue;

            // Write back with proper formatting (2 space indent)
            fs.writeFileSync(localeFile, JSON.stringify(data, null, 2) + "\n", "utf-8");
        } catch (error) {
            throw new Error(`  ✗ ${locale}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

main();
