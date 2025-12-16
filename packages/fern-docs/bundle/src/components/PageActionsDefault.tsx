"use client";

import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { capturePosthogEventInternal } from "@/components/analytics/posthog";
import { PageActionItem } from "./PageActionItem";

export function PageActionsDefault({
    options,
    defaultOption,
    lang,
    onValueChange,
    onCopyPage
}: {
    options: FernDropdown.PageActionOption[];
    defaultOption: FernDropdown.ValueOption;
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

    const handleDefaultAction = async () => {
        if (!defaultOption) {
            return;
        }

        if (defaultOption.value === "copy-page") {
            capturePosthogEventInternal("page_actions_dropdown", {
                type: "copy-button",
                page_location: window.location.pathname
            });
            void handleCopyPage();
        } else if (defaultOption.href) {
            // For options with href, navigate to the URL
            capturePosthogEventInternal("page_actions_dropdown", {
                type: defaultOption.value === "view-as-markdown" ? "markdown" : defaultOption.value,
                page_location: window.location.pathname
            });
            window.open(defaultOption.href, "_blank", "noopener,noreferrer");
        } else {
            void onValueChange(defaultOption.value);
        }
    };

    return (
        <div className="fern-page-actions">
            <FernButton
                variant="minimal"
                className={cn("w-fit px-2", options.length > 1 && "rounded-r-none")}
                onClick={handleDefaultAction}
            >
                <div className="flex items-center gap-2">
                    <PageActionItem
                        option={defaultOption}
                        lang={lang}
                        variant="defaultOption"
                        onCopyPage={handleCopyPage}
                        showCopied={showCopied}
                        onValueChange={onValueChange}
                    />
                </div>
            </FernButton>
            {options.length > 1 && (
                <FernDropdown
                    options={options}
                    onValueChange={(value) => void onValueChange(value)}
                    dropdownMenuElement={<a target="_blank" rel="noopener noreferrer" />}
                    lang={lang}
                    align="end"
                >
                    <FernButton
                        variant="minimal"
                        className="group rounded-l-none px-2"
                        onClick={() => {
                            capturePosthogEventInternal("page_actions_dropdown", {
                                type: "open",
                                page_location: window.location.pathname
                            });
                        }}
                    >
                        <ChevronDown className="size-icon animate-dropdown-chevron" />
                    </FernButton>
                </FernDropdown>
            )}
        </div>
    );
}
