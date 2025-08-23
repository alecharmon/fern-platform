import { PropsWithChildren, ReactElement, ReactNode } from "react";

import { FernTooltip } from "@fern-docs/components";

interface TooltipProps {
  tip: string | ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

export function Tooltip({
  children,
  tip,
  side = "top",
  sideOffset = 4,
}: PropsWithChildren<TooltipProps>): ReactElement<any> {
  return (
    <FernTooltip
      content={tip}
      side={side}
      sideOffset={sideOffset}
      delayDuration={0}
      className="p-0.5"
    >
      <span
        className="inline-block cursor-help underline decoration-dashed underline-offset-2"
        style={{ position: "relative" }}
      >
        {children}
      </span>
    </FernTooltip>
  );
}
