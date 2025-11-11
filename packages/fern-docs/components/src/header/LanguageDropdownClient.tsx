"use client";

import { useIsDesktop } from "@fern-ui/react-commons";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { FernDropdown } from "../FernDropdown";

export interface LanguageDropdownItem {
    language: string;
    label: string;
    slug: string;
}

const FLAG_SVGS: Record<string, string> = {
    en: new URL("./flag-assets/us.svg", import.meta.url).toString(),
    es: new URL("./flag-assets/es.svg", import.meta.url).toString(),
    fr: new URL("./flag-assets/fr.svg", import.meta.url).toString(),
    de: new URL("./flag-assets/de.svg", import.meta.url).toString(),
    it: new URL("./flag-assets/it.svg", import.meta.url).toString(),
    pt: new URL("./flag-assets/pt.svg", import.meta.url).toString(),
    ja: new URL("./flag-assets/jp.svg", import.meta.url).toString(),
    zh: new URL("./flag-assets/cn.svg", import.meta.url).toString(),
    ko: new URL("./flag-assets/kr.svg", import.meta.url).toString(),
    el: new URL("./flag-assets/gr.svg", import.meta.url).toString(),
    no: new URL("./flag-assets/no.svg", import.meta.url).toString(),
    pl: new URL("./flag-assets/pl.svg", import.meta.url).toString(),
    ru: new URL("./flag-assets/ru.svg", import.meta.url).toString(),
    sv: new URL("./flag-assets/se.svg", import.meta.url).toString(),
    tr: new URL("./flag-assets/tr.svg", import.meta.url).toString()
};

function FlagIcon({ src }: { src: string | undefined }) {
    if (!src) {
        return null;
    }
    return (
        <div className="inline-flex h-3 w-4 items-center justify-center overflow-hidden rounded-sm border border-border-default">
            <img src={src} className="h-full w-full object-cover" alt="" aria-hidden loading="lazy" />
        </div>
    );
}

export function LanguageDropdownClient({
    languages,
    useDenseLayout = false,
    lang
}: {
    languages: LanguageDropdownItem[];
    useDenseLayout?: boolean;
    lang: string;
}) {
    const isDesktop = useIsDesktop();
    const [currentLanguage, setCurrentLanguage] = useState<string>(lang);

    const currentLanguageItem = languages.find((lang) => lang.language === currentLanguage) ?? languages[0];

    if (!currentLanguageItem) {
        return null;
    }

    return (
        <FernDropdown
            value={currentLanguage}
            options={languages.map(({ language, label, slug }) => {
                const flagSrc = FLAG_SVGS[language];
                const icon = <FlagIcon src={flagSrc} key={`${language}-flag`} />;
                return {
                    type: "value" as const,
                    label,
                    value: language,
                    href: slug,
                    icon: flagSrc ? icon : undefined
                };
            })}
            contentProps={{
                "data-testid": "language-dropdown-content"
            }}
            side="bottom"
            align={isDesktop ? "start" : "center"}
            triggerAsChild={false}
            className="fern-language-selector w-full justify-center lg:w-auto"
            radioGroupProps={{
                className: "fern-language-selector-radio-group"
            }}
            onValueChange={(value) => {
                setCurrentLanguage(value);
                const selectedLanguage = languages.find((lang) => lang.language === value);
                if (selectedLanguage) {
                    window.location.href = selectedLanguage.slug;
                }
            }}
            lang={lang}
        >
            <div className="language-dropdown-trigger h-9" data-testid="language-dropdown">
                <div className="inline-flex items-center gap-2">
                    <FlagIcon src={FLAG_SVGS[currentLanguageItem.language]} />
                    <p className="language-item-title w-fit">{currentLanguageItem.label}</p>
                </div>
                <ChevronDown className="size-icon" />
            </div>
        </FernDropdown>
    );
}
