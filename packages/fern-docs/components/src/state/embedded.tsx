"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const embeddedAtom = atom(false);

export function EmbeddedProvider() {
    const searchParams = useSearchParams();
    const setEmbedded = useSetAtom(embeddedAtom);

    useEffect(() => {
        const embeddedParam = searchParams.get("embedded");
        if (embeddedParam === "true") {
            setEmbedded(true);
        }
    }, [searchParams, setEmbedded]);

    return null;
}

export function useIsEmbedded(): boolean {
    return useAtomValue(embeddedAtom);
}
