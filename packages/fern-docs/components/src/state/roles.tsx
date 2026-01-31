"use client";

import { useDeepCompareMemoize } from "@fern-ui/react-commons";
import { type Atom, atom, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

interface UseRolesOptions {
    __test_roles_atom?: Atom<string[]>;
}

export const rolesAtom = atom<string[]>([]);

export function SetRoles({ value }: { value: string[] }) {
    const memoizedValue = useDeepCompareMemoize(value);
    useHydrateAtoms([[rolesAtom, memoizedValue]], {
        dangerouslyForceHydrate: true
    });
    return null;
}

export function useRoles({ __test_roles_atom }: UseRolesOptions = {}): string[] {
    return useAtomValue(__test_roles_atom ?? rolesAtom);
}
