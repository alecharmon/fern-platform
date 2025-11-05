"use client";

import { useIsDesktop } from "@fern-ui/react-commons";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../cn";
import { FernDropdown } from "../FernDropdown";
import { FernSelectionItem } from "../FernSelectionItem";

export interface LanguageDropdownItem {
    language: string;
    label: string;
    slug: string;
}

export function LanguageDropdownClient({
    languages,
    useDenseLayout = false,
    lang = "en"
}: {
    languages: LanguageDropdownItem[];
    useDenseLayout?: boolean;
    lang?: string;
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
                return {
                    type: "value" as const,
                    label,
                    value: language,
                    href: slug
                };
            })}
            contentProps={{
                "data-testid": "language-dropdown-content"
            }}
            side="bottom"
            align={isDesktop ? "start" : "center"}
            triggerAsChild={false}
            className="fern-language-selector w-full lg:w-auto"
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
            <div
                className={cn("language-dropdown-trigger hidden h-9", {
                    "lg:flex": !useDenseLayout
                })}
                data-testid="language-dropdown"
            >
                <p className="language-item-title w-fit">{currentLanguageItem.label}</p>
                <ChevronDown className="size-icon" />
            </div>

            <FernSelectionItem
                title={currentLanguageItem.label}
                dense
                endIcon={<ChevronsUpDown className="size-icon" />}
                className={cn("language-dropdown-trigger", {
                    "lg:hidden!": !useDenseLayout
                })}
                testId="language-dropdown"
            />
        </FernDropdown>
    );
}
