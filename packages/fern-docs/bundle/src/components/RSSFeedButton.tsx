"use client";

import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";
import { Rss } from "lucide-react";

export function RSSFeedButton({ lang }: { lang: string }) {
    const getRssUrl = () => {
        const currentUrl = window.location.href;
        return `${currentUrl}.rss`;
    };

    const handleClick = () => {
        const rssUrl = getRssUrl();
        window.open(rssUrl, "_blank");
    };

    return (
        <FernButton
            variant="outlined"
            onClick={handleClick}
            rounded
            className="fern-rss-feed-button"
            rightIcon={<Rss className="text-(color:--accent-a11) size-3.5" />}
        >
            {t(lang).documentation.subscribeViaRss}
        </FernButton>
    );
}
