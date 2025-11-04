import defaultTranslations from "./locales/en/common.json";
import esTranslations from "./locales/es/common.json";
import type { Translations } from "./types";

const translations: Record<string, Translations> = {
    en: defaultTranslations,
    es: esTranslations
};

export const t = (locale?: string): Translations => {
    const lang = locale ?? "en";
    return translations[lang] ?? defaultTranslations;
};
