"use client";

import { atom, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

const printModeAtom = atom(false);

/**
 * Signals that the current render is for PDF/print export.
 * When active, interactive UI elements like collapsible property sections
 * are rendered in their expanded state without toggle buttons.
 */
export function PrintMode({ value }: { value: boolean }) {
    useHydrateAtoms([[printModeAtom, value]], { dangerouslyForceHydrate: true });
    return null;
}

export function useIsPrintMode() {
    return useAtomValue(printModeAtom);
}
