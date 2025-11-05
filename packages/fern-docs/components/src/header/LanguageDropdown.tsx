import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { LanguageDropdownClient, type LanguageDropdownItem } from "./LanguageDropdownClient";

export declare namespace LanguageDropdown {
    export interface Props {}
}

/**
 * The language dropdown is used to switch between available languages.
 * Languages are defined in the docs config at config.languages.
 */
export async function LanguageDropdown({
    loader,
    useDenseLayout = false,
    nodeSlug,
    lang
}: {
    loader: DocsLoader;
    useDenseLayout?: boolean;
    nodeSlug?: string;
    lang?: string;
}) {
    const config = await loader.getConfig();

    if (!config.languages || config.languages.length === 0) {
        return null;
    }

    const languageOptions: LanguageDropdownItem[] = config.languages.map((language) => ({
        language,
        label: getLanguageLabel(language),
        slug: `/${language}${nodeSlug ? `/${decodeURIComponent(nodeSlug)}` : ""}`
    }));

    return <LanguageDropdownClient languages={languageOptions} useDenseLayout={useDenseLayout} lang={lang} />;
}

/**
 * Map language codes to human-readable labels
 */
function getLanguageLabel(language: string): string {
    const languageLabels: Record<string, string> = {
        en: "English",
        es: "Español",
        fr: "Français",
        de: "Deutsch",
        it: "Italiano",
        pt: "Português",
        ja: "日本語",
        zh: "中文",
        ko: "한국어",
        el: "Ελληνικά",
        no: "Norsk",
        pl: "Polski",
        ru: "Русский",
        sv: "Svenska",
        tr: "Türkçe"
    };

    // const languageFlags: Record<string, string> = {
    //     en: "🇺🇸",
    //     es: "🇪🇸",
    //     fr: "🇫🇷",
    //     de: "🇩🇪",
    //     it: "🇮🇹",
    //     pt: "🇵🇹",
    //     ja: "🇯🇵",
    //     zh: "🇨🇳",
    //     ko: "🇰🇷",
    //     el: "🇬🇷",
    //     no: "🇳🇴",
    //     pl: "🇵🇱",
    //     ru: "🇷🇺",
    //     sv: "🇸🇪",
    //     tr: "🇹🇷"
    // };

    return languageLabels[language] ?? language.toUpperCase();
}
