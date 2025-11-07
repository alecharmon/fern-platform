import deTranslations from "./locales/de/common.json";
import elTranslations from "./locales/el/common.json";
import enTranslations from "./locales/en/common.json";
import esTranslations from "./locales/es/common.json";
import frTranslations from "./locales/fr/common.json";
import itTranslations from "./locales/it/common.json";
import jaTranslations from "./locales/ja/common.json";
import koTranslations from "./locales/ko/common.json";
import noTranslations from "./locales/no/common.json";
import plTranslations from "./locales/pl/common.json";
import ptTranslations from "./locales/pt/common.json";
import ruTranslations from "./locales/ru/common.json";
import svTranslations from "./locales/sv/common.json";
import trTranslations from "./locales/tr/common.json";
import zhTranslations from "./locales/zh/common.json";
import type { Translations } from "./types";

const translations: Record<string, Translations> = {
    de: deTranslations,
    el: elTranslations,
    en: enTranslations,
    es: esTranslations,
    fr: frTranslations,
    it: itTranslations,
    ja: jaTranslations,
    ko: koTranslations,
    no: noTranslations,
    pl: plTranslations,
    pt: ptTranslations,
    ru: ruTranslations,
    sv: svTranslations,
    tr: trTranslations,
    zh: zhTranslations
};

export const t = (locale?: string): Translations => {
    const lang = locale ?? "en";
    return translations[lang] ?? enTranslations;
};
