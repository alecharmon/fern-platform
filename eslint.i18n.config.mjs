// @ts-check

import i18nextPlugin from "eslint-plugin-i18next";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "**/generated",
            "**/dist",
            "**/build",
            "**/.next",
            "**/storybook-static",
            "**/out",
            "**/lib",
            "**/node_modules",
            "**/*.stories.{ts,tsx}",
            "**/*.test.{ts,tsx}",
            "**/.storybook/**",
            // Files with inline comments for plugins we don't load in this config
            "**/bundle/scripts/performance.ts",
            "**/components/src/FernImage.tsx"
        ]
    },
    {
        files: ["packages/fern-docs/**/*.{ts,tsx}"],
        plugins: {
            i18next: i18nextPlugin,
            // @ts-expect-error - Plugin types not compatible with flat config
            "react-hooks": reactHooks,
            "unused-imports": unusedImports,
            "@typescript-eslint": tseslint.plugin
        },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: ["./tsconfig.eslint.json"],
                tsconfigRootDir: import.meta.dirname
            }
        },
        linterOptions: {
            // Don't report errors for unknown rules in inline comments
            reportUnusedDisableDirectives: "off"
        },
        rules: {
            "i18next/no-literal-string": [
                "error",
                {
                    // Only check JSX text and attributes, not all string literals
                    markupOnly: true,
                    // Ignore common patterns that don't need translation
                    // These are treated as regex patterns
                    words: {
                        exclude: [
                            "^ms$",
                            "^b$",
                            "^px$",
                            "^%$",
                            "^TypeScript$",
                            "^JavaScript$",
                            "^Python$",
                            "^cURL$",
                            "^curl$",
                            "^JSON$",
                            "^API$",
                            "^HTTP$",
                            "^HTTPS$",
                            "^REST$",
                            "^GraphQL$",
                            "^WebSocket$",
                            "^WSS$",
                            "^WS$",
                            "^GET$",
                            "^POST$",
                            "^PUT$",
                            "^PATCH$",
                            "^DELETE$",
                            "^HEAD$",
                            "^OPTIONS$",
                            "^STREAM$",
                            "^Esc$",
                            "^Del$",
                            "^Enter$",
                            "^Tab$",
                            "^Shift$",
                            // Keyboard modifiers
                            "^ctrl$",
                            "^cmd$",
                            "^alt$",
                            "^meta$",
                            // Common special characters and separators
                            "^\\|$",
                            "^\\$$",
                            "^\\+$",
                            "^\\-$",
                            "^\\/$",
                            // Typographic characters (both HTML entities and actual Unicode chars)
                            "^&mdash;$",
                            "^\u2014$", // em dash (—)
                            "^&ldquo;$",
                            "^&rdquo;$",
                            "^\u201c$", // left double quotation mark (")
                            "^\u201d$", // right double quotation mark (")
                            "^\u201d\\.$", // right quote followed by period
                            "^\\.\\.\\.$",
                            "^\\.\\.\\..*",
                            "^ctrl\\+.*",
                            // Single characters and punctuation (including curly quotes)
                            "^[.,:;!?()\\[\\]{}'\"\u201c\u201d`]$",
                            // Numbers (exact or decimal)
                            "^[0-9]+$",
                            "^[0-9]+\\.[0-9]+$",
                            // Common fragments that appear with translated text
                            "^\\.$",
                            "^:$",
                            "^ $"
                        ]
                    },
                    // Ignore specific attributes that typically don't need translation
                    ignoreAttribute: [
                        "className",
                        "style",
                        "data-*",
                        "aria-*",
                        "role",
                        "type",
                        "id",
                        "key",
                        "ref",
                        "value",
                        "href",
                        "src",
                        "target",
                        "rel"
                    ],
                    // Ignore specific components where children don't need translation
                    ignoreComponent: [
                        "VisuallyHidden", // Often contains screen reader text in English
                        "Kbd", // Keyboard shortcuts
                        "Code",
                        "Pre",
                        "Script",
                        "Style"
                    ]
                }
            ],
            "unused-imports/no-unused-vars": "off",
            "react-hooks/exhaustive-deps": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/consistent-indexed-object-style": "off",
            "@typescript-eslint/no-deprecated": "off",
            "@typescript-eslint/unbound-method": "off",
            "turbo/no-undeclared-env-vars": "off",
            "@next/next/no-img-element": "off"
        }
    }
);
