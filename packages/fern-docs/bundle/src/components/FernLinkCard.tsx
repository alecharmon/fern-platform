import { cn } from "@fern-docs/components/cn";
import type { FernCardProps } from "@fern-docs/components/FernCard";
import { FernLink } from "@fern-docs/components/FernLink";
import type { LinkProps } from "next/link";
import { forwardRef, type PropsWithChildren } from "react";

export const FernLinkCard = forwardRef<
    HTMLAnchorElement,
    PropsWithChildren<FernCardProps & Omit<LinkProps, "href"> & { href: string }>
>(function FernLinkCard({ children, className, ...props }, ref) {
    return (
        <FernLink className={cn("fern-card interactive", className)} {...props} ref={ref}>
            {children}
        </FernLink>
    );
});
