"use client";

import Link from "next/link";
import React from "react";

import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
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
        mobileTitle?: string;
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

export const NavbarItem = ({
    title,
    mobileTitle,
    icon,
    iconType,
    href,
    hrefForActualLinking = href
}: NavbarItem.Props) => {
    const ANIMATION_DURATION_MS = 1400;
    const [hoverAnimating, setHoverAnimating] = React.useState(false);
    const hoverTimeoutRef = React.useRef<number | null>(null);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);

    const handleMouseEnter = () => {
        if (isMobile) return;
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
        if (isMobile) return;
        setIsHovered(false);
    };

    const handleTouchEnd = () => {
        if (isMobile) {
            setIsHovered(false);
            setHoverAnimating(false);
        }
    };

    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => {
            if (hoverTimeoutRef.current != null) {
                window.clearTimeout(hoverTimeoutRef.current);
            }
            window.removeEventListener("resize", checkMobile);
        };
    }, []);

    const orgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();
    const [isCollapsed] = useIsSidebarCollapsed();

    const isSelected = pathname.startsWith(href);
    const isClickable = !isSelected;
    const strokeColor = isSelected ? "var(--green-1100)" : isHovered ? "var(--gray-1100)" : "var(--gray-900)";

    const className = cn(
        "group flex flex-1 flex-col items-center gap-2 py-2 text-sm transition md:flex-row focus:ring-0 focus:outline-none px-2 md:px-0",
        isSelected ? "text-primary" : "text-gray-900",
        isClickable && "hover:text-gray-1100",
        hoverAnimating && "hover-animating",
        isCollapsed && "md:justify-center"
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

            {!isCollapsed &&
                (mobileTitle ? (
                    <>
                        <div className="md:hidden">{mobileTitle}</div>
                        <div className="hidden md:block">{title}</div>
                    </>
                ) : (
                    <div>{title}</div>
                ))}
        </>
    );

    if (isClickable) {
        return (
            <Link
                className={className}
                href={`/${orgName}/${hrefForActualLinking}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </Link>
        );
    } else {
        return (
            <div
                className={className}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        );
    }
};
