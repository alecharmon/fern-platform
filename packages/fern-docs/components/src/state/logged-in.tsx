"use client";

import { type Atom, atom, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

interface UseLoggedInOptions {
    __test_logged_in_atom?: Atom<boolean>;
}

export const loggedInAtom = atom<boolean>(false);

export function SetLoggedIn({ value }: { value: boolean }) {
    useHydrateAtoms([[loggedInAtom, value]], {
        dangerouslyForceHydrate: true
    });
    return null;
}

export function useLoggedIn({ __test_logged_in_atom }: UseLoggedInOptions = {}): boolean {
    return useAtomValue(__test_logged_in_atom ?? loggedInAtom);
}
