"use client";

import { Badge } from "@fern-docs/components/badges";
import { FernTooltip } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { useCopyToClipboard } from "@fern-ui/react-commons";
import React from "react";

type ChipProps = {
    name: string;
    description?: React.ReactNode;
    lang: string;
};

const ChipSizeCtx = React.createContext<"sm" | "lg">("lg");

export const ChipSizeProvider = ({ children, size }: { children: React.ReactNode; size: "sm" | "lg" }) => {
    return <ChipSizeCtx.Provider value={size}>{children}</ChipSizeCtx.Provider>;
};

export const Chip = ({ name, description = undefined, lang }: ChipProps) => {
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
