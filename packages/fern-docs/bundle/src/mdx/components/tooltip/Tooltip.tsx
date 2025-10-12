import { FernTooltip } from "@fern-docs/components/FernTooltip";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";

interface TooltipProps {
    tip: string | ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
}

export function Tooltip({
    children,
    tip,
    side = "top",
    sideOffset = 4
}: PropsWithChildren<TooltipProps>): ReactElement<any> {
    return (
        <FernTooltip
            content={tip}
            side={side}
            sideOffset={sideOffset}
            delayDuration={0}
            className="fern-mdx-tooltip-content"
        >
            <span className="fern-mdx-tooltip-trigger">{children}</span>
        </FernTooltip>
    );
}
