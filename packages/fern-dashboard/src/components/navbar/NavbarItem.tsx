"use client";

import Link from "next/link";
import React from "react";

import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

import { AlertIconAnimated } from "./AlertIconAnimated";
import { CodeBracketIconAnimated } from "./CodeBracketIconAnimated";
import { CreditCardIconAnimated } from "./CreditCardIconAnimated";
import { KeyIconAnimated } from "./KeyIconAnimated";
import { SettingsIconAnimated } from "./SettingsIconAnimated";
import { UsersIconAnimated } from "./UsersIconAnimated";

export declare namespace NavbarItem {
    export interface Props {
        title: string;
        icon?: React.JSX.Element;
        iconType?: "members" | "api-keys" | "billing" | "docs" | "sdks" | "settings" | "incidents";

        /**
         * href is used to determine:
         *   (1) if this item is selected: pathname.startsWith(href)
         *   (2) the href for the <a />
         *       (to override, use hrefForActualLinking)
         */
        href: `/${string}`;
        hrefForActualLinking?: string;
    }
}

export const ICON_SIZE = "size-5";

export const NavbarItem = ({ title, icon, iconType, href, hrefForActualLinking = href }: NavbarItem.Props) => {
    const ANIMATION_DURATION_MS = 1400;
    const [hoverAnimating, setHoverAnimating] = React.useState(false);
    const hoverTimeoutRef = React.useRef<number | null>(null);
    const [isHovered, setIsHovered] = React.useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
        setHoverAnimating(true);
        if (hoverTimeoutRef.current != null) {
            window.clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = window.setTimeout(() => {
            setHoverAnimating(false);
            hoverTimeoutRef.current = null;
        }, ANIMATION_DURATION_MS);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    React.useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current != null) {
                window.clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    const orgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();

    const isSelected = pathname.startsWith(href);
    const isClickable = !isSelected;
    const strokeColor = isSelected ? "var(--green-1100)" : isHovered ? "var(--gray-1100)" : "var(--gray-900)";

    const className = cn(
        "group flex flex-1 flex-col items-center gap-2 py-2 text-sm transition md:flex-row",
        isSelected ? "text-primary" : "text-gray-900",
        isClickable && "hover:text-gray-1100",
        hoverAnimating && "hover-animating"
    );

    const children = (
        <>
            {icon}
            {iconType === "members" && <UsersIconAnimated className={ICON_SIZE} strokeColor={strokeColor} />}
            {iconType === "api-keys" && <KeyIconAnimated className={ICON_SIZE} strokeColor={strokeColor} />}
            {iconType === "billing" && <CreditCardIconAnimated className={ICON_SIZE} strokeColor={strokeColor} />}
            {iconType === "sdks" && <CodeBracketIconAnimated className={ICON_SIZE} strokeColor={strokeColor} />}
            {iconType === "settings" && <SettingsIconAnimated className={ICON_SIZE} strokeColor={strokeColor} />}
            {iconType === "incidents" && <AlertIconAnimated className={ICON_SIZE} strokeColor={strokeColor} />}

            <div>{title}</div>
        </>
    );

    if (isClickable) {
        return (
            <Link
                className={className}
                href={`/${orgName}/${hrefForActualLinking}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </Link>
        );
    } else {
        return (
            <div className={className} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {children}
            </div>
        );
    }
};
