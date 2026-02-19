"use client";

import { FernTooltip } from "@fern-docs/components/FernTooltip";
import * as Popover from "@radix-ui/react-popover";
import { type PropsWithChildren, type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

interface TooltipProps {
    tip: string | ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
}

function useIsTouchDevice(): boolean | null {
    const [isTouchDevice, setIsTouchDevice] = useState<boolean | null>(null);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
        setIsTouchDevice(mediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => {
            setIsTouchDevice(e.matches);
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    return isTouchDevice;
}

function getScrollParents(el: HTMLElement): HTMLElement[] {
    const parents: HTMLElement[] = [];
    let node: HTMLElement | null = el.parentElement;
    while (node) {
        const { overflowY, overflowX } = getComputedStyle(node);
        if (/(auto|scroll|overlay)/.test(overflowY) || /(auto|scroll|overlay)/.test(overflowX)) {
            parents.push(node);
        }
        node = node.parentElement;
    }
    return parents;
}

export function Tooltip({
    children,
    tip: rawTip,
    side = "top",
    sideOffset = 4
}: PropsWithChildren<TooltipProps>): ReactElement<any> {
    const tip = typeof rawTip === "string" ? <Markdown>{rawTip}</Markdown> : rawTip;
    const isTouchDevice = useIsTouchDevice();
    const [isOpen, setIsOpen] = useState(false);
    const [boundary, setBoundary] = useState<HTMLElement | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!triggerRef.current) {
            return;
        }
        const parents = getScrollParents(triggerRef.current);
        setBoundary((parents[0] as HTMLElement) ?? document.body);
    }, []);

    useEffect(() => {
        if (!isOpen || !isTouchDevice) {
            return;
        }

        const close = () => setIsOpen(false);
        const opts: AddEventListenerOptions = { passive: true };

        window.addEventListener("scroll", close, opts);
        window.addEventListener("resize", close, opts);
        window.addEventListener("orientationchange", close, opts);

        const parents = triggerRef.current ? getScrollParents(triggerRef.current) : [];
        parents.forEach((p) => p.addEventListener("scroll", close, opts));

        return () => {
            window.removeEventListener("scroll", close);
            window.removeEventListener("resize", close);
            window.removeEventListener("orientationchange", close);
            parents.forEach((p) => p.removeEventListener("scroll", close));
        };
    }, [isOpen, isTouchDevice]);

    if (isTouchDevice) {
        const mobileSide = side === "left" || side === "right" ? "top" : side;

        return (
            <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
                <Popover.Trigger asChild>
                    <span
                        ref={triggerRef}
                        className="fern-mdx-tooltip-trigger"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setIsOpen(!isOpen);
                            }
                        }}
                    >
                        {children}
                    </span>
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Content
                        side={mobileSide}
                        sideOffset={sideOffset}
                        align="center"
                        avoidCollisions
                        collisionPadding={16}
                        collisionBoundary={boundary ?? undefined}
                        className="fern-mdx-tooltip-content animate-popover rounded-2 shadow-card-grayscale z-50 max-w-[min(20rem,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-auto break-words border border-border-default bg-background p-2 text-center text-sm leading-normal backdrop-blur will-change-[transform,opacity]"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        {tip}
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        );
    }

    return (
        <FernTooltip
            content={tip}
            side={side}
            sideOffset={sideOffset}
            delayDuration={0}
            className="fern-mdx-tooltip-content"
        >
            <span className="fern-mdx-tooltip-trigger">{children}</span>
        </FernTooltip>
    );
}
