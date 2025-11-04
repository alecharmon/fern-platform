"use client";

import { Button } from "../ui/button";

export declare namespace HeaderLinkButton {
    export interface Props {
        text: string;
        href: string;
        icon?: React.ReactNode;
        rightIcon?: React.ReactNode;
        className?: string;
        onClick?: () => void;
        buttonProps?: React.ComponentProps<typeof Button>;
        openInNewTab?: boolean;
    }
}

export function HeaderLinkButton({
    text,
    href,
    icon,
    rightIcon,
    className,
    onClick,
    buttonProps,
    openInNewTab = true
}: HeaderLinkButton.Props) {
    if (onClick) {
        return (
            <Button size="sm" variant="ghost" className={className} onClick={onClick} {...buttonProps}>
                {icon}
                {text}
                {rightIcon && <span className="ml-auto">{rightIcon}</span>}
            </Button>
        );
    }

    return (
        <Button size="sm" variant="ghost" asChild className={className} {...buttonProps}>
            <a href={href} {...(openInNewTab && { target: "_blank" })}>
                {icon}
                {text}
                {rightIcon && <span className="ml-auto">{rightIcon}</span>}
            </a>
        </Button>
    );
}
