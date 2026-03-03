"use client";

import { atom, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

const airgappedAtom = atom(false);

export function Airgapped({ value }: { value: boolean }) {
    useHydrateAtoms([[airgappedAtom, value]], {
        dangerouslyForceHydrate: true
    });
    return null;
}

export function useIsAirgapped() {
    return useAtomValue(airgappedAtom);
}
