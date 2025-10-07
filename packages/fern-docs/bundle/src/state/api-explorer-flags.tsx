"use client";

import { atom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

export const isProxyDisabledAtom = atom(false);
export const isBinaryOctetStreamAudioPlayerAtom = atom(false);

export function ApiExplorerFlags({
    isProxyDisabled,
    isBinaryOctetStreamAudioPlayer
}: {
    isProxyDisabled: boolean;
    isBinaryOctetStreamAudioPlayer: boolean;
}) {
    useHydrateAtoms(
        [
            [isProxyDisabledAtom, isProxyDisabled],
            [isBinaryOctetStreamAudioPlayerAtom, isBinaryOctetStreamAudioPlayer]
        ],
        { dangerouslyForceHydrate: true }
    );
    return null;
}
