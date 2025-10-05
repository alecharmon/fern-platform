"use client";

import { type ReactElement, useEffect, useState } from "react";

import { useAtom, useAtomValue } from "jotai/react";
import { RESET } from "jotai/utils";
import { ChevronDown } from "lucide-react";

import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";

import {
    PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM,
    PLAYGROUND_AUTH_STATE_BEARER_TOKEN_IS_RESETTABLE_ATOM
} from "@/state/playground";

import { PasswordInputGroup } from "../PasswordInputGroup";
import { type AuthOption, convertAuthOptionsToToken, parseAuthOptions, returnSelectedOption } from "../utils";

export function PlaygroundBearerAuthForm({
    bearerAuth,
    disabled
}: {
    bearerAuth: APIV1Read.BearerAuth;
    disabled?: boolean;
}): ReactElement<any> {
    const [value, setValue] = useAtom(PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM);
    const [authOptions, setAuthOptions] = useState<AuthOption[]>([]);
    const isBearerTokenResettable = useAtomValue(PLAYGROUND_AUTH_STATE_BEARER_TOKEN_IS_RESETTABLE_ATOM);

    const handleOptionSelect = (selectedKey: string) => {
        const updatedOptions = authOptions.map((option) => ({
            ...option,
            selected: option.key === selectedKey
        }));
        const token = convertAuthOptionsToToken(updatedOptions);
        // update global auth state with selected option
        setValue({ token });
    };

    // refresh selected auth if global auth state changes
    useEffect(() => {
        const token = value.token;
        const options = parseAuthOptions(token);
        setAuthOptions(options);
    }, [value.token, setValue]);

    if (authOptions.length > 0) {
        return (
            <li className="-mx-4 space-y-2 p-4">
                <div className="flex flex-row items-center justify-between gap-2">
                    <label className="inline-flex flex-wrap items-baseline">
                        <span className="font-mono text-sm">{bearerAuth.tokenName ?? "Bearer token"}</span>
                    </label>

                    {authOptions.length > 0 && (
                        <FernDropdown
                            value={returnSelectedOption(value.token).key}
                            onValueChange={handleOptionSelect}
                            options={authOptions.map((option) => ({
                                type: "auth",
                                key: option.key,
                                value: option.value,
                                selected: option.selected
                            }))}
                        >
                            <FernButton
                                text={returnSelectedOption(value.token).key}
                                variant="outlined"
                                rightIcon={<ChevronDown />}
                            />
                        </FernDropdown>
                    )}
                </div>

                <PasswordInputGroup
                    onValueChange={(newValue) => setValue({ token: newValue })}
                    value={returnSelectedOption(value.token).value}
                    autoComplete="off"
                    data-1p-ignore="true"
                    disabled={disabled}
                    resettable={isBearerTokenResettable}
                    onClickReset={() => setValue(RESET)}
                />
            </li>
        );
    }

    return (
        <li className="-mx-4 space-y-2 p-4">
            <label className="inline-flex flex-wrap items-baseline">
                <span className="font-mono text-sm">{bearerAuth.tokenName ?? "Bearer token"}</span>
            </label>

            <div>
                <PasswordInputGroup
                    onValueChange={(newValue) => setValue({ token: newValue })}
                    value={value.token}
                    autoComplete="off"
                    data-1p-ignore="true"
                    disabled={disabled}
                    resettable={isBearerTokenResettable}
                    onClickReset={() => setValue(RESET)}
                />
            </div>
        </li>
    );
}
