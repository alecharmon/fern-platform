"use client";

import { cn } from "@fern-docs/components/cn";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { t } from "@fern-docs/i18n";
import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { PageActionItem } from "./PageActionItem";

export function PageActionsToolbar({
    options,
    lang,
    onValueChange,
    onCopyPage
}: {
    options: FernDropdown.PageActionOption[];
    lang: string;
    onValueChange: (value: string) => Promise<void>;
    onCopyPage: () => Promise<boolean>;
}) {
    const [showCopied, setShowCopied] = useState<boolean>(false);

    const handleCopyPage = async () => {
        const success = await onCopyPage();
        if (success) {
            setShowCopied(true);
            setTimeout(() => {
                setShowCopied(false);
            }, 2000);
        }
    };

    // should already have no separators, but for type safety we filter
    const items = options.filter((option) => option.type !== "separator");

    if (items.length === 0) {
        return null;
    }

    const rankingOrder = [
        "open-ai-search",
        "copy-page",
        "view-as-markdown",
        "open-claude",
        "open-chatgpt",
        "open-cursor"
    ];

    const sortedItems = [...items].sort((a, b) => {
        const aIndex = rankingOrder.indexOf(a.value);
        const bIndex = rankingOrder.indexOf(b.value);

        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }

        if (aIndex !== -1) {
            return -1;
        }

        if (bIndex !== -1) {
            return 1;
        }

        return 0;
    });

    const MAX_VISIBLE = 3;
    const visibleItems = sortedItems.slice(0, MAX_VISIBLE);
    const overflowItems = sortedItems.slice(MAX_VISIBLE);

    return (
        <div className={cn("fern-page-actions flex flex-wrap items-center text-sm py-4 -ml-2", "fern-toolbar mb-0")}>
            {visibleItems.map((item, i) => (
                <Fragment key={item.value}>
                    {i > 0 && (
                        <span aria-hidden="true" className="text-(color:--grayscale-a8)" style={{ margin: "0 8px" }}>
                            {"|"}
                        </span>
                    )}
                    <PageActionItem
                        option={item}
                        lang={lang}
                        variant="toolbar"
                        onCopyPage={handleCopyPage}
                        showCopied={showCopied}
                        onValueChange={onValueChange}
                    />
                </Fragment>
            ))}
            {overflowItems.length > 0 && (
                <>
                    {visibleItems.length > 0 && (
                        <span aria-hidden="true" className="text-(color:--grayscale-a8)" style={{ margin: "0 8px" }}>
                            {"|"}
                        </span>
                    )}
                    <FernDropdown
                        options={overflowItems}
                        onValueChange={(value) => void onValueChange(value)}
                        dropdownMenuElement={<a target="_blank" rel="noopener noreferrer" />}
                        lang={lang}
                    >
                        <button
                            aria-label={t(lang).buttons.moreActions}
                            className="group px-2 py-1 rounded-2 text-(color:--grayscale-a11) hover:bg-(color:--accent-a3) hover:text-(color:--accent-12) transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <span>{t(lang).buttons.moreActions}</span>
                            <ChevronDown className="size-icon animate-dropdown-chevron" />
                        </button>
                    </FernDropdown>
                </>
            )}
        </div>
    );
}
