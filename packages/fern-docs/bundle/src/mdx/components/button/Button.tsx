import type { ReactElement, ReactNode } from "react";

import { FernButton } from "@fern-docs/components/FernButton";
import { cn } from "@fern-docs/components/cn";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";

import { DisableFernAnchor } from "@/components/FernAnchor";

export declare namespace Button {
    export interface Props {
        className?: string;
        icon?: string | ReactNode;
        rightIcon?: string | ReactNode;
        minimal?: boolean;
        outlined?: boolean;
        mono?: boolean;
        full?: boolean;
        rounded?: boolean;
        active?: boolean;
        disabled?: boolean;
        small?: boolean;
        large?: boolean;
        intent?: "none" | "primary" | "success" | "warning" | "danger";
        text?: ReactNode;
        href?: string;
    }
}

export function Button({
    minimal,
    outlined,
    small,
    large,
    href,
    className,
    ...props
}: Button.Props): ReactElement<any> {
    const variant = outlined ? "outlined" : minimal ? "minimal" : "filled";
    const size = small ? "small" : large ? "large" : "normal";
    if (href != null) {
        return (
            <DisableFernAnchor>
                <FernLinkButton
                    href={href}
                    scroll={true}
                    {...props}
                    variant={variant}
                    size={size}
                    className={cn(className, "not-prose")}
                />
            </DisableFernAnchor>
        );
    }

    return <FernButton {...props} variant={variant} size={size} className={cn(className, "not-prose")} />;
}
