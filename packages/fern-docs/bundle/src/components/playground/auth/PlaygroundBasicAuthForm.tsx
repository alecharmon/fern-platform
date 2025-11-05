"use client";

import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { FernInput } from "@fern-docs/components/FernInput";
import { t } from "@fern-docs/i18n";
import { useAtom, useAtomValue } from "jotai/react";
import { RESET } from "jotai/utils";
import { User } from "lucide-react";
import { type ReactElement, useEffect } from "react";
import {
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_ATOM,
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_IS_RESETTABLE_ATOM,
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_ATOM,
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_IS_RESETTABLE_ATOM,
    useResolvedPlaygroundState
} from "@/state/playground";
import { PasswordInputGroup } from "../PasswordInputGroup";

export function PlaygroundBasicAuthForm({
    basicAuth,
    disabled,
    lang
}: {
    basicAuth: APIV1Read.BasicAuth;
    disabled?: boolean;
    lang: string;
}): ReactElement<any> {
    const [username, setUsername] = useAtom(PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_ATOM);
    const [password, setPassword] = useAtom(PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_ATOM);
    const isUsernameResettable = useAtomValue(PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_IS_RESETTABLE_ATOM);
    const isPasswordResettable = useAtomValue(PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_IS_RESETTABLE_ATOM);

    const resolvedState = useResolvedPlaygroundState();

    // if the resolved state changes (on env update), update the auth state
    useEffect(() => {
        setUsername(resolvedState?.auth?.basic?.username ?? "");
        setPassword(resolvedState?.auth?.basic?.password ?? "");
    }, [resolvedState?.auth?.basic?.username, resolvedState?.auth?.basic?.password, setUsername, setPassword]);

    return (
        <>
            <li className="-mx-4 space-y-2 p-4">
                <label className="inline-flex flex-wrap items-baseline">
                    <span className="font-mono text-sm">{basicAuth.usernameName ?? t(lang).auth.username}</span>
                </label>
                <div>
                    <FernInput
                        onValueChange={setUsername}
                        value={username}
                        leftIcon={<User className="size-icon" />}
                        disabled={disabled}
                        resettable={isUsernameResettable}
                        onClickReset={() => setUsername(RESET)}
                    />
                </div>
            </li>

            <li className="-mx-4 space-y-2 p-4">
                <label className="inline-flex flex-wrap items-baseline">
                    <span className="font-mono text-sm">{basicAuth.passwordName ?? t(lang).auth.password}</span>
                </label>

                <div>
                    <PasswordInputGroup
                        onValueChange={setPassword}
                        value={password}
                        disabled={disabled}
                        resettable={isPasswordResettable}
                        onClickReset={() => setPassword(RESET)}
                    />
                </div>
            </li>
        </>
    );
}
