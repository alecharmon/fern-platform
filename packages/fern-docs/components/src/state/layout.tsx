"use client";

import type { FernDocs } from "@fern-api/fdr-sdk";

import { atom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

const layoutAtom = atom<FernDocs.Layout>("guide");

export function SetLayout({ value }: { value: FernDocs.Layout }) {
    const setLayout = useSetAtom(layoutAtom);
    useEffect(() => {
        setLayout(value);
    }, [value, setLayout]);
    return null;
}

export function useLayout() {
    return useAtomValue(layoutAtom);
}
