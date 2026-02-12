"use client";

import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";
import { useSetAtom } from "jotai";
import { ArrowLeft, X } from "lucide-react";
import { useCallback } from "react";

import { useUrlParams } from "@/hooks/use-url-params";
import { PLAYGROUND_EXPLORER_OPEN_ATOM } from "@/state/playground";

export function NoEndpointSelected({ lang }: { lang: string }) {
    const { removeUrlParamFromPathname } = useUrlParams();
    const setExplorerOpen = useSetAtom(PLAYGROUND_EXPLORER_OPEN_ATOM);

    const handleClose = useCallback(() => {
        setExplorerOpen(false);
        const url = removeUrlParamFromPathname("explorer");
        window.history.replaceState(window.history.state, "", url);
    }, [setExplorerOpen, removeUrlParamFromPathname]);

    return (
        <div className="flex size-full flex-col items-center justify-center">
            <div className="absolute right-4 top-4">
                <FernButton icon={<X />} size="large" rounded variant="outlined" onClick={handleClose} />
            </div>
            <ArrowLeft className="t-muted mb-2 size-8" />
            <h6 className="t-muted">{t(lang).playground.selectAnEndpointToGetStarted}</h6>
        </div>
    );
}
