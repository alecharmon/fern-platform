"use client";

import { FernButton } from "@fern-docs/components/FernButton";
import { tunnel } from "@fern-ui/react-commons";
import { useSetAtom } from "jotai";
import { X } from "lucide-react";
import React, { useCallback } from "react";

import { useUrlParams } from "@/hooks/use-url-params";
import { PLAYGROUND_EXPLORER_OPEN_ATOM } from "@/state/playground";

export const closeButton = tunnel();

export function PlaygroundCloseButton() {
    const { removeUrlParamFromPathname } = useUrlParams();
    const setExplorerOpen = useSetAtom(PLAYGROUND_EXPLORER_OPEN_ATOM);

    const handleClose = useCallback(() => {
        setExplorerOpen(false);
        const url = removeUrlParamFromPathname("explorer");
        window.history.replaceState(window.history.state, "", url);
    }, [setExplorerOpen, removeUrlParamFromPathname]);

    return (
        <closeButton.In>
            <FernButton icon={<X />} size="large" rounded variant="outlined" onClick={handleClose} />
        </closeButton.In>
    );
}

export function InterceptedPlaygroundCloseButton() {
    const { removeUrlParamFromPathname } = useUrlParams();
    const setExplorerOpen = useSetAtom(PLAYGROUND_EXPLORER_OPEN_ATOM);

    const handleClose = useCallback(() => {
        setExplorerOpen(false);
        const url = removeUrlParamFromPathname("explorer");
        window.history.replaceState(window.history.state, "", url);
    }, [setExplorerOpen, removeUrlParamFromPathname]);

    React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                handleClose();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [handleClose]);
    return (
        <closeButton.In>
            <FernButton icon={<X />} size="large" rounded variant="outlined" onClick={handleClose} />
        </closeButton.In>
    );
}
