"use client";

import { t } from "@fern-docs/i18n";
import { useCopyToClipboard } from "@fern-ui/react-commons";
import React from "react";

import { Badge } from "./badges";
import { FernTooltip } from "./FernTooltip";

type ChipProps = {
    name: string;
    description?: React.ReactNode;
    lang?: string;
};

const ChipSizeCtx = React.createContext<"sm" | "lg">("lg");

export const ChipSizeProvider = ({ children, size }: { children: React.ReactNode; size: "sm" | "lg" }) => {
    return <ChipSizeCtx.Provider value={size}>{children}</ChipSizeCtx.Provider>;
};

export const Chip = ({ name, description = undefined, lang = "en" }: ChipProps) => {
    const { copyToClipboard, wasJustCopied } = useCopyToClipboard(name);
    const size = React.useContext(ChipSizeCtx);
    return (
        <FernTooltip
            open={wasJustCopied ? true : !description ? false : undefined}
            content={wasJustCopied ? t(lang).buttons.copied : description}
        >
            <Badge
                onClick={() => {
                    void copyToClipboard?.();
                }}
                size={size}
            >
                {name}
            </Badge>
        </FernTooltip>
    );
};
