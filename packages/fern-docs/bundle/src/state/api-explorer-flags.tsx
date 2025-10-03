"use client";

import { atom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

export const isFileForgeHackEnabledAtom = atom(false);
export const isProxyDisabledAtom = atom(false);
export const usesApplicationJsonInFormDataValueAtom = atom(false);
export const isBinaryOctetStreamAudioPlayerAtom = atom(false);

export function ApiExplorerFlags({
    isFileForgeHackEnabled,
    isProxyDisabled,
    usesApplicationJsonInFormDataValue,
    isBinaryOctetStreamAudioPlayer
}: {
    isFileForgeHackEnabled: boolean;
    isProxyDisabled: boolean;
    usesApplicationJsonInFormDataValue: boolean;
    isBinaryOctetStreamAudioPlayer: boolean;
}) {
    useHydrateAtoms(
        [
            [isFileForgeHackEnabledAtom, isFileForgeHackEnabled],
            [isProxyDisabledAtom, isProxyDisabled],
            [usesApplicationJsonInFormDataValueAtom, usesApplicationJsonInFormDataValue],
            [isBinaryOctetStreamAudioPlayerAtom, isBinaryOctetStreamAudioPlayer]
        ],
        { dangerouslyForceHydrate: true }
    );
    return null;
}
