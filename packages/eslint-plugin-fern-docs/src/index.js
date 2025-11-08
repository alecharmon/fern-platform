import { requireI18nTranslations } from "./rules/require-i18n-translations.js";

export const rules = {
  "require-i18n-translations": requireI18nTranslations,
};

export const configs = {
  recommended: {
    plugins: ["fern-docs"],
    rules: {
      "fern-docs/require-i18n-translations": "error",
    },
  },
};
