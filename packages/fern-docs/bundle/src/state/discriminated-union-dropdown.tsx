"use client";

import { atom, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

const discriminatedUnionDropdownEnabledAtom = atom(false);

export function DiscriminatedUnionDropdownEnabled({ value }: { value: boolean }) {
    useHydrateAtoms([[discriminatedUnionDropdownEnabledAtom, value]], {
        dangerouslyForceHydrate: true
    });
    return null;
}

export function useIsDiscriminatedUnionDropdownEnabled() {
    return useAtomValue(discriminatedUnionDropdownEnabledAtom);
}
