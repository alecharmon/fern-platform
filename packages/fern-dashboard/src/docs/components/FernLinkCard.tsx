import { cn } from "@fern-docs/components/cn";
import { FernLink } from "@fern-docs/components/FernLink";
import type { LinkProps } from "next/link";
import { forwardRef, type PropsWithChildren } from "react";

export const FernLinkCard = forwardRef<HTMLAnchorElement, PropsWithChildren<FernCardProps & LinkProps>>(
    function FernLinkCard({ children, className, ...props }, ref) {
        return (
            <FernLink
                className={cn("fern-card interactive", className)}
                {...props}
                href={props.href?.toString()}
                ref={ref}
            >
                {children}
            </FernLink>
        );
    }
);
