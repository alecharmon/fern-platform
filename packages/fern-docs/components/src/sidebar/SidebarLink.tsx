"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { ChevronDown, Lock } from "lucide-react";
import React, {
    forwardRef,
    type HTMLAttributeAnchorTarget,
    type PropsWithChildren,
    type ReactNode,
    useEffect,
    useRef,
    useState
} from "react";
import { cn } from "../cn";
import { FernLink } from "../FernLink";
import { FernTooltip } from "../FernTooltip";
import { useScrollSidebarNodeIntoView } from "../hooks/sidebar-scroll";
import { useIsSelectedSidebarNode } from "../state/navigation";

interface SidebarSlugLinkProps {
    nodeId: FernNavigation.NodeId;
    icon?: React.ReactNode;
    slug?: FernNavigation.Slug;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onToggleExpand?: (e: React.MouseEvent<HTMLElement | SVGSVGElement>) => void;
    className?: string;
    title?: ReactNode;
    shallow?: boolean;
    scroll?: boolean;
    selected?: boolean;
    showIndicator?: boolean;
    depth?: number;
    expanded?: boolean;
    rightElement?: ReactNode;
    tooltipContent?: ReactNode;
    hidden?: boolean;
    authed?: boolean;
}

type SidebarLinkProps = PropsWithChildren<
    Omit<SidebarSlugLinkProps, "registerScrolledToPathListener" | "slug"> & {
        // Link props
        href?: string;
        rel?: string | undefined;
        target?: HTMLAttributeAnchorTarget | undefined;

        elementRef?: React.Ref<HTMLDivElement>;
    }
>;

const SidebarLinkInternal = React.forwardRef<HTMLAnchorElement, SidebarLinkProps>((props, forwardRef) => {
    const {
        icon,
        className,
        title,
        onToggleExpand,
        onClick,
        shallow,
        // scroll,
        href,
        selected,
        showIndicator,
        depth = 0,
        expanded = false,
        rightElement,
        tooltipContent,
        target,
        rel,
        hidden,
        authed
    } = props;

    const containerRef = useRef<HTMLSpanElement>(null);
    const contentRef = useRef<HTMLSpanElement>(null);

    const [isBreakable, setIsBreakable] = useState(false);

    // biome-ignore lint/correctness/useExhaustiveDependencies: title is needed to re-evaluate when title prop changes (important-comment)
    useEffect(() => {
        const text = contentRef.current?.textContent ?? "";
        setIsBreakable(/[ \t\r\n]/.test(text));
    }, [title]);

    const handleMouseEnter = () => {
        if (isBreakable) {
            return;
        }
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) {
            return;
        }

        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        const delta = Math.ceil(container.scrollWidth - container.clientWidth);
        if (delta <= 0) {
            return;
        }

        const pxPerSec = 90;
        const duration = Math.max(0.8, delta / pxPerSec);

        content.style.setProperty("--marquee-translate", `${-delta}px`);
        content.style.setProperty("--marquee-duration", `${duration}s`);
        content.classList.add("is-marquee");
        container.classList.add("marquee-active");
    };

    const handleMouseLeave = () => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!content || !container) {
            return;
        }
        content.classList.remove("is-marquee");
        content.style.removeProperty("--marquee-translate");
        content.style.removeProperty("--marquee-duration");
        content.style.transform = "";
        container.classList.remove("marquee-active");
    };

    const expandButton = (!!onToggleExpand || expanded) && (
        <ChevronDown
            className={cn("expand-indicator", expanded ? "rotate-180" : "rotate-0")}
            data-state={showIndicator ? "active" : "inactive"}
            onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleExpand?.(e);
            }}
        />
    );

    const withTooltip = (children: ReactNode) => {
        let content = tooltipContent;
        if (authed) {
            content = "You must be logged in to view this page";
        }

        if (content == null) {
            return children;
        }

        return (
            <FernTooltip content={content} side="right">
                {children}
            </FernTooltip>
        );
    };

    const sharedClassName = cn(
        "fern-sidebar-link",
        `fern-sidebar-level-${depth + 1}`,
        { "opacity-50": hidden },
        depth > 0 && "nested",
        className
    );

    return withTooltip(
        href ? (
            <FernLink
                ref={forwardRef}
                href={href}
                scroll={true}
                shallow={shallow}
                target={target}
                rel={rel}
                className={sharedClassName}
                onClick={(e) => {
                    onClick?.(e);

                    if (e.isDefaultPrevented()) {
                        return;
                    }

                    // if the link is not selected AND is expanded, we do NOT want to close it.
                    if (selected || !expanded) {
                        onToggleExpand?.(e);
                    }
                }}
                data-state={selected ? "active" : "inactive"}
            >
                {icon}
                <span
                    className={cn("fern-sidebar-link-title mr-auto w-full", isBreakable && "wrap-mode")}
                    ref={containerRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <span ref={contentRef} className="fern-sidebar-link-title-inner">
                        {title}
                    </span>
                </span>
                {authed ? <Lock /> : rightElement}
                {expandButton}
            </FernLink>
        ) : (
            <button
                ref={forwardRef as React.ForwardedRef<HTMLButtonElement>}
                className={sharedClassName}
                onClick={(e) => {
                    onClick?.(e);

                    if (e.isDefaultPrevented()) {
                        return;
                    }

                    onToggleExpand?.(e);
                }}
                data-state={selected ? "active" : "inactive"}
            >
                {icon}
                <span
                    className={cn("fern-sidebar-link-title mr-auto w-full", isBreakable && "wrap-mode")}
                    ref={containerRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <span ref={contentRef} className="fern-sidebar-link-title-inner">
                        {title}
                    </span>
                </span>
                {authed ? <Lock /> : rightElement}
                {expandButton}
            </button>
        )
    );
});

SidebarLinkInternal.displayName = "SidebarLink";

export const SidebarLink = React.memo(SidebarLinkInternal);

export const SidebarSlugLink = forwardRef<HTMLAnchorElement, PropsWithChildren<Omit<SidebarSlugLinkProps, "selected">>>(
    (props, forwardRef) => {
        const { slug, ...innerProps } = props;
        const ref = useRef<HTMLAnchorElement>(null);
        useScrollSidebarNodeIntoView(ref, props.nodeId);
        const selected = useIsSelectedSidebarNode(props.nodeId);
        const href = slug != null ? slugToHref(slug) : undefined;
        return (
            <SidebarLink
                {...innerProps}
                ref={composeRefs(forwardRef, ref)}
                href={href}
                onClick={composeEventHandlers(innerProps.onClick, () => {
                    // if (href) {
                    //   scrollToRoute(href);
                    // }
                })}
                shallow={innerProps.shallow || selected}
                scroll={!innerProps.shallow}
                selected={selected}
            />
        );
    }
);

SidebarSlugLink.displayName = "SidebarSlugLink";
