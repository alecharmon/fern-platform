import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";

// Capture all possible environments in a list, in useEffect at top level
export const ALL_ENVIRONMENTS_ATOM = atom<string[]>([]);

export const useSetAllEnvironments = (allEnvironmentIds: string[]): void => {
    const setAllEnvironments = useSetAtom(ALL_ENVIRONMENTS_ATOM);
    setAllEnvironments(allEnvironmentIds);
};

// Get or select an environment based on the ID
export const SELECTED_ENVIRONMENT_ID_ATOM = atomWithStorage<string | undefined>("selected-environment-id", undefined);

export const useSelectedEnvironmentId = (): string | undefined => {
    return useAtomValue(SELECTED_ENVIRONMENT_ID_ATOM);
};

export const useAllEnvironmentIds = (): string[] => {
    return useAtomValue(ALL_ENVIRONMENTS_ATOM);
};

// separately track the URL that matches the given environment + api
// used to match the environment specified in the playground env_state key
const selectedEnvironmentUrlFamily = atomFamily((apiDefinitionId: FdrAPI.ApiDefinitionId | undefined) => {
    const storageKey = apiDefinitionId ? `selected-environment-url:${apiDefinitionId}` : "selected-environment-url";
    const urlAtom = atomWithStorage<string | undefined>(storageKey, undefined);
    urlAtom.debugLabel = `selected-environment-url:${apiDefinitionId ?? "global"}`;
    return urlAtom;
});

export const SELECTED_ENVIRONMENT_URL_ATOM = selectedEnvironmentUrlFamily(undefined);

export const useSelectedEnvironmentUrl = (apiDefinitionId?: FdrAPI.ApiDefinitionId): string | undefined => {
    return useAtomValue(selectedEnvironmentUrlFamily(apiDefinitionId));
};

export const useSelectedEnvironmentUrlAtom = (apiDefinitionId?: FdrAPI.ApiDefinitionId) => {
    return selectedEnvironmentUrlFamily(apiDefinitionId);
};
