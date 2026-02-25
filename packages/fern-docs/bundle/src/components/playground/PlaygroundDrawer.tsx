"use client";

import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { useIsomorphicLayoutEffect } from "@fern-ui/react-commons";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useAtom } from "jotai";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useRef } from "react";
import { Drawer } from "vaul";
import { useUrlParams } from "@/hooks/use-url-params";
import { PLAYGROUND_EXPLORER_OPEN_ATOM } from "@/state/playground";

import { useHeaderHeight, useViewportSize } from "../hooks/useViewportSize";

export function PlaygroundDrawer({ children }: { children: React.ReactNode }) {
    const [snap, setSnap] = React.useState<number | string | null>(null);
    const { removeUrlParamFromPathname, addUrlParamToPathname } = useUrlParams();
    const [open, setOpen] = useAtom(PLAYGROUND_EXPLORER_OPEN_ATOM);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has("explorer")) {
            setOpen(true);
        }
    }, [setOpen]);

    const pathname = usePathname();
    const prevPathnameRef = useRef(pathname);

    useEffect(() => {
        if (prevPathnameRef.current !== pathname) {
            prevPathnameRef.current = pathname;
            const params = new URLSearchParams(window.location.search);
            if (!params.has("explorer")) {
                setOpen(false);

                // When the drawer closes during navigation, Radix UI's DismissableLayer
                // can leave pointer-events: none stuck on the body due to a race condition
                // where its cleanup restores a stale value. This is a known Radix bug:
                // https://github.com/radix-ui/primitives/issues/3645
                requestAnimationFrame(() => {
                    if (document.body.style.pointerEvents === "none") {
                        document.body.style.pointerEvents = "";
                    }
                });
            }
        }
    }, [pathname, setOpen]);

    const viewport = useViewportSize();
    const headerHeight = useHeaderHeight();

    useIsomorphicLayoutEffect(() => {
        if (open) {
            setTimeout(() => {
                if (open) {
                    document.body.style.pointerEvents = "auto";
                    setSnap(1);
                }
                // transition takes 500ms to complete
            }, 500);
        }
        return () => {
            setSnap(null);
        };
    }, [open]);

    /**
     * This function is used to handle the open change event of the drawer, this ensures that
     * the URL param is always in sync with the drawer's open state.
     */
    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            setOpen(nextOpen);
            const url = nextOpen ? addUrlParamToPathname("explorer", "true") : removeUrlParamFromPathname("explorer");
            window.history.replaceState(window.history.state, "", url);
        },
        [setOpen, removeUrlParamFromPathname, addUrlParamToPathname]
    );

    return (
        <Drawer.Root
            open={open}
            onOpenChange={handleOpenChange}
            modal={false}
            dismissible={false}
            disablePreventScroll
            snapPoints={[`${headerHeight + 61}px`, `${viewport.height / 2 + headerHeight / 2 + 1}px`, 1]}
            activeSnapPoint={snap}
            setActiveSnapPoint={setSnap}
            snapToSequentialPoint
            noBodyStyles
            preventScrollRestoration
            handleOnly
            // reposition inputs seem to be quite buggy with the way the playground is implemented
            repositionInputs={false}
        >
            <Drawer.Portal>
                <Drawer.Overlay />
                <Drawer.Content
                    onCloseAutoFocus={(e) => {
                        e.preventDefault();
                        document
                            .getElementById(`playground-button:${slugjoin(removeUrlParamFromPathname("explore"))}`)
                            ?.focus();
                    }}
                    className="api-explorer width-before-scroll-bar"
                >
                    <Drawer.Handle
                        className="bg-(color:--grayscale-a4) absolute mx-auto -mb-1.5 h-1.5 w-12 flex-shrink-0 -translate-y-3 cursor-pointer rounded-full"
                        preventCycle
                    />
                    <VisuallyHidden>
                        <Drawer.Title>API Explorer</Drawer.Title>
                        <Drawer.Description>
                            Browse, explore, and try out API endpoints without leaving the documentation.
                        </Drawer.Description>
                    </VisuallyHidden>
                    {children}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
