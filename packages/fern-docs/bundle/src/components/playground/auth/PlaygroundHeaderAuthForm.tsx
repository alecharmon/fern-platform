"use client";

import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { unknownToString } from "@fern-api/ui-core-utils";
import { atom } from "jotai";
import { useAtom, useAtomValue } from "jotai/react";
import { RESET } from "jotai/utils";
import type { ReactElement, SetStateAction } from "react";
import { useMemoOne } from "use-memo-one";

import { PLAYGROUND_AUTH_STATE_HEADER_ATOM, PLAYGROUND_RESOLVED_STATE_ATOM } from "@/state/playground";

import { PasswordInputGroup } from "../PasswordInputGroup";

// Create a unique storage key by combining auth key and header name
export function getHeaderStorageKey(authKey: string, headerName: string): string {
    return `${authKey}:${headerName}`;
}

function headerAtom(authKey: string, headerName: string) {
    const storageKey = getHeaderStorageKey(authKey, headerName);
    return atom(
        (get) => get(PLAYGROUND_AUTH_STATE_HEADER_ATOM).headers[storageKey],
        (_get, set, change: SetStateAction<string> | typeof RESET) => {
            set(PLAYGROUND_AUTH_STATE_HEADER_ATOM, ({ headers }) => {
                const nextHeaderValue = typeof change === "function" ? change(headers[storageKey] ?? "") : change;
                if (nextHeaderValue === RESET) {
                    return {
                        // note: this will remove all undefined values from the object
                        headers: JSON.parse(
                            JSON.stringify({
                                ...headers,
                                [storageKey]: undefined
                            })
                        )
                    };
                }
                return {
                    headers: {
                        ...headers,
                        [storageKey]: nextHeaderValue
                    }
                };
            });
        }
    );
}

function isHeaderResettableAtom(authKey: string, headerName: string) {
    const storageKey = getHeaderStorageKey(authKey, headerName);
    return atom((get) => {
        const inputHeader = get(PLAYGROUND_AUTH_STATE_HEADER_ATOM).headers[storageKey];
        const injectedHeader = get(PLAYGROUND_RESOLVED_STATE_ATOM)?.headers?.[headerName];
        return injectedHeader != null && injectedHeader !== inputHeader;
    });
}

export function PlaygroundHeaderAuthForm({
    header,
    authKey,
    disabled
}: {
    header: APIV1Read.HeaderAuth;
    authKey: string;
    disabled?: boolean;
}): ReactElement<any> {
    const [value, setValue] = useAtom(
        useMemoOne(() => headerAtom(authKey, header.headerWireValue), [authKey, header.headerWireValue])
    );
    const isResettable = useAtomValue(
        useMemoOne(() => isHeaderResettableAtom(authKey, header.headerWireValue), [authKey, header.headerWireValue])
    );

    return (
        <li className="-mx-4 space-y-2 p-4">
            <label className="inline-flex flex-wrap items-baseline">
                <span className="font-mono text-sm">{header.nameOverride ?? header.headerWireValue}</span>
            </label>
            <div>
                <PasswordInputGroup
                    onValueChange={setValue}
                    value={unknownToString(value ?? "")}
                    autoComplete="off"
                    data-1p-ignore="true"
                    disabled={disabled}
                    resettable={isResettable}
                    onClickReset={() => setValue(RESET)}
                />
            </div>
        </li>
    );
}
