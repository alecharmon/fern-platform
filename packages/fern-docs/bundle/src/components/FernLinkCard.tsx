import type { LinkProps } from "next/link";
import { type PropsWithChildren, forwardRef } from "react";

import { cn } from "@fern-docs/components/cn";
import { FernLink } from "@fern-docs/components/FernLink";

export const FernLinkCard = forwardRef<HTMLAnchorElement, PropsWithChildren<FernCardProps & LinkProps>>(
    function FernLinkCard({ children, className, ...props }, ref) {
        return (
            <FernLink className={cn("fern-card interactive", className)} {...props} ref={ref}>
                {children}
            </FernLink>
        );
    }
);
