import { ESLintUtils } from "@typescript-eslint/utils";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/fern-api/fern-platform/blob/main/packages/eslint-plugin-fern-docs/docs/${name}.md`
);

function buildTranslationMap(translations, prefix = "") {
  const map = {};
  
  for (const [key, value] of Object.entries(translations)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === "string") {
      map[value] = fullKey;
    } else if (typeof value === "object" && value !== null) {
      Object.assign(map, buildTranslationMap(value, fullKey));
    }
  }
  
  return map;
}

const enTranslationsPath = join(__dirname, "../../../commons/i18n/src/locales/en/common.json");
const enTranslations = JSON.parse(readFileSync(enTranslationsPath, "utf-8"));
const translationMap = buildTranslationMap(enTranslations);

export const requireI18nTranslations = createRule({
  name: "require-i18n-translations",
  meta: {
    type: "problem",
    docs: {
      description: "Require user-facing strings to use i18n translations instead of plaintext",
    },
    messages: {
      requireI18n: "User-facing text '{{text}}' should use i18n translations (t(lang).{{suggestion}})",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    
    let hasI18nImport = false;

    function checkTextContent(node, text) {
      const trimmedText = text.trim();
      
      if (trimmedText.length === 0 || trimmedText.length < 2) {
        return;
      }
      
      if (
        /^[a-z_-]+$/.test(trimmedText) || // kebab-case or snake_case
        /^[A-Z_]+$/.test(trimmedText) || // SCREAMING_SNAKE_CASE
        /^\//.test(trimmedText) || // paths
        /^\d+$/.test(trimmedText) || // numbers only
        /^[^a-zA-Z]+$/.test(trimmedText) || // no letters
        /^[a-z]/.test(trimmedText) || // starts with lowercase (likely a variable name or technical term)
        trimmedText.includes("{{") || // template variables
        trimmedText.includes("${") || // template literals
        trimmedText.includes("://") || // URLs
        trimmedText.includes("@") // emails or decorators
      ) {
        return;
      }
      
      const suggestion = translationMap[trimmedText];
      
      if (suggestion) {
        context.report({
          node,
          messageId: "requireI18n",
          data: {
            text: trimmedText,
            suggestion,
          },
        });
      } else if (/^[A-Z]/.test(trimmedText) && trimmedText.split(/\s+/).length <= 5) {
        context.report({
          node,
          messageId: "requireI18n",
          data: {
            text: trimmedText,
            suggestion: "appropriate.translation.key",
          },
        });
      }
    }

    return {
      Program(node) {
        const imports = sourceCode.ast.body.filter(
          (n) => n.type === "ImportDeclaration"
        );
        
        hasI18nImport = imports.some(
          (imp) => imp.source.value === "@fern-docs/i18n"
        );
      },
      
      JSXText(node) {
        if (!hasI18nImport) {
          return; // Only check files that already use i18n
        }
        
        const text = node.value;
        checkTextContent(node, text);
      },
      
      JSXAttribute(node) {
        if (!hasI18nImport) {
          return;
        }
        
        const attrName = node.name.type === "JSXIdentifier" ? node.name.name : null;
        const userFacingAttrs = ["title", "aria-label", "placeholder", "alt"];
        
        if (
          attrName &&
          userFacingAttrs.includes(attrName) &&
          node.value &&
          node.value.type === "Literal" &&
          typeof node.value.value === "string"
        ) {
          checkTextContent(node.value, node.value.value);
        }
      },
    };
  },
});
