import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isLocal } from "../util/isLocal";
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
    nodeSlug,
    lang
}: {
    loader: DocsLoader;
    nodeSlug?: string;
    lang: string;
}) {
    const config = await loader.getConfig();

    if (!config.languages || config.languages.length === 0) {
        return null;
    }

    const normalizedNodeSlug = nodeSlug ? decodeURIComponent(nodeSlug) : undefined;
    const removedLanguagePrefix = normalizedNodeSlug ? removeLanguagePrefix(lang, normalizedNodeSlug) : undefined;
    const languageOptions: LanguageDropdownItem[] = config.languages.map((language) => ({
        language,
        label: getLanguageLabel(language),
        slug: removedLanguagePrefix ? `/${language}/${removedLanguagePrefix}` : `/${language}`
    }));

    return <LanguageDropdownClient languages={languageOptions} lang={lang} disabled={isLocal()} />;
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

    return languageLabels[language] ?? language.toUpperCase();
}

function removeLanguagePrefix(lang: string, slug: string): string {
    if (slug.startsWith(`${lang}`)) {
        return slug.slice(lang.length + 1);
    }
    return slug;
}
