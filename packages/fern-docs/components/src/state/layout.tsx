"use client";

import { useEffect } from "react";

import { atom, useAtomValue, useSetAtom } from "jotai";

import type { FernDocs } from "@fern-api/fdr-sdk";

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

export function HiddenSidebar() {
    return (
        <style jsx global>{`
      #fern-toc,
      #fern-sidebar[data-state="sticky"],
      #fern-sidebar[data-state="fixed"],
      #fern-sidebar-spacer {
        visibility: hidden;
        width: 0;
        overflow: hidden;
        display: none;
      }
    `}</style>
    );
}
