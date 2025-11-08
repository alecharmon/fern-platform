// @ts-check
import tseslint from "typescript-eslint";
import i18nextPlugin from "eslint-plugin-i18next";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

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
    ],
  },
  {
    files: ["packages/fern-docs/**/*.{ts,tsx}"],
    plugins: {
      "i18next": i18nextPlugin,
      // @ts-expect-error - Plugin types not compatible with flat config
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "i18next/no-literal-string": ["error", {
        markupOnly: false,
      }],
      "unused-imports/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  }
);
