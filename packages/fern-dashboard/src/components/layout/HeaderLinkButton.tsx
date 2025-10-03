"use client";

import { Button } from "../ui/button";

export declare namespace HeaderLinkButton {
    export interface Props {
        text: string;
        href: string;
        icon?: React.ReactNode;
        className?: string;
        onClick?: () => void;
        buttonProps?: React.ComponentProps<typeof Button>;
    }
}

export function HeaderLinkButton({ text, href, icon, className, onClick, buttonProps }: HeaderLinkButton.Props) {
    if (onClick) {
        return (
            <Button size="sm" variant="ghost" className={className} onClick={onClick} {...buttonProps}>
                {icon}
                {text}
            </Button>
        );
    }

    return (
        <Button size="sm" variant="ghost" asChild className={className} {...buttonProps}>
            <a href={href} target="_blank">
                {icon}
                {text}
            </a>
        </Button>
    );
}
