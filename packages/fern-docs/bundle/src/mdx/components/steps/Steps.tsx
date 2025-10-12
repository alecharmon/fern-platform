import { cn } from "@fern-docs/components/cn";
import React, { type ComponentProps, type ReactElement } from "react";

import { StepCtx } from "./Step";

export function StepGroup({ children, className, ...props }: ComponentProps<"div">): ReactElement<any> {
    return (
        <div className={cn("fern-steps", className)} {...props}>
            {React.Children.map(children, (child, index) => (
                <StepCtx.Provider key={index} value={index + 1}>
                    {child}
                </StepCtx.Provider>
            ))}
        </div>
    );
}
