"use client";

import { FernButton } from "@fern-docs/components/FernButton";

import { Rss } from "lucide-react";
import React from "react";

export function RSSFeedButton() {
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
            Subscribe via <span className="text-(color:--accent-a11)">RSS</span>
        </FernButton>
    );
}
