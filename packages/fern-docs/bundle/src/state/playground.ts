"use client";

import type { EndpointContext, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useDomain } from "@fern-docs/components/state/domain";
import { fernUserAtom } from "@fern-docs/components/state/fern-user";
import { atom, useAtomValue, type WritableAtom } from "jotai";
import { atomFamily, atomWithStorage, RESET, useAtomCallback } from "jotai/utils";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import { useCallbackOne } from "use-memo-one";

import {
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_INITIAL,
    PLAYGROUND_AUTH_STATE_BEARER_TOKEN_INITIAL,
    PLAYGROUND_AUTH_STATE_HEADER_INITIAL,
    PLAYGROUND_AUTH_STATE_OAUTH_INITIAL,
    type PlaygroundAuthState,
    type PlaygroundAuthStateBasicAuth,
    type PlaygroundAuthStateBearerToken,
    type PlaygroundAuthStateHeader,
    type PlaygroundAuthStateOAuth,
    PlaygroundAuthStateSchema,
    type PlaygroundEndpointRequestFormState,
    type PlaygroundRequestFormState,
    type PlaygroundWebSocketRequestFormState
} from "../components/playground/types";
import {
    getInitialEndpointRequestFormStateWithExample,
    getInitialWebSocketRequestFormState,
    resolveEndpointEnvironmentState
} from "../components/playground/utils";
import { SELECTED_ENVIRONMENT_URL_ATOM } from "./environment";
import { atomWithStorageValidation } from "./utils/atomWithStorageValidation";

// initial state + env state based on current environment
export const PLAYGROUND_RESOLVED_STATE_ATOM = atom((get) => {
    const environment = get(SELECTED_ENVIRONMENT_URL_ATOM);
    const initialState = get(PLAYGROUND_INITIAL_STATE_ATOM);
    const envState = get(PLAYGROUND_ENV_STATE_ATOM);

    let resolvedState = initialState;
    if (envState && environment) {
        resolvedState = resolveEndpointEnvironmentState({
            currentEnvironment: environment,
            initialState,
            envState
        });
    }

    return resolvedState;
});

export const PLAYGROUND_AUTH_STATE_ATOM = atomWithStorageValidation<PlaygroundAuthState>(
    "playground-auth-state",
    {},
    {
        validate: PlaygroundAuthStateSchema,
        isSession: true,
        getOnInit: true
    }
);

/**
 * Stores the selected auth type key (from authSchemes map in API definition).
 * Used to remember which auth scheme the user prefers across different endpoints.
 */
export const PLAYGROUND_SELECTED_AUTH_TYPE_ATOM = atomWithStorage<string | null>(
    "playground-selected-auth-type",
    null,
    undefined,
    {
        getOnInit: true
    }
);

export const PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM = atom(
    (get) => ({
        token:
            get(PLAYGROUND_AUTH_STATE_ATOM).bearerAuth?.token ??
            get(PLAYGROUND_RESOLVED_STATE_ATOM)?.auth?.bearer_token ??
            ""
    }),
    (_get, set, update: SetStateAction<PlaygroundAuthStateBearerToken> | typeof RESET) => {
        set(PLAYGROUND_AUTH_STATE_ATOM, ({ bearerAuth: prevBearerAuth, ...rest }) => {
            const nextBearerAuth =
                typeof update === "function"
                    ? update(prevBearerAuth ?? PLAYGROUND_AUTH_STATE_BEARER_TOKEN_INITIAL)
                    : update;

            if (nextBearerAuth === RESET) {
                return rest;
            }

            return { ...rest, bearerAuth: nextBearerAuth };
        });
    }
);

/**
 * If an injected bearer token is provided, the input bearer token should be resettable if it's not empty.
 */
export const PLAYGROUND_AUTH_STATE_BEARER_TOKEN_IS_RESETTABLE_ATOM = atom((get) => {
    const inputBearerAuth = get(PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM).token;
    const injectedBearerAuth = get(PLAYGROUND_RESOLVED_STATE_ATOM)?.auth?.bearer_token;
    return injectedBearerAuth != null && inputBearerAuth !== injectedBearerAuth;
});

export const PLAYGROUND_AUTH_STATE_HEADER_ATOM = atom(
    (get) => ({
        headers: {
            ...(get(PLAYGROUND_AUTH_STATE_ATOM).header?.headers ?? get(PLAYGROUND_RESOLVED_STATE_ATOM)?.headers)
        }
    }),
    (_get, set, update: SetStateAction<PlaygroundAuthStateHeader> | typeof RESET) => {
        set(PLAYGROUND_AUTH_STATE_ATOM, ({ header: prevHeader, ...rest }) => {
            const nextHeader =
                typeof update === "function" ? update(prevHeader ?? PLAYGROUND_AUTH_STATE_HEADER_INITIAL) : update;

            if (nextHeader === RESET) {
                return rest;
            }

            return { ...rest, header: nextHeader };
        });
    }
);

export const PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM = atom(
    (get) => ({
        username:
            get(PLAYGROUND_AUTH_STATE_ATOM).basicAuth?.username ??
            get(PLAYGROUND_RESOLVED_STATE_ATOM)?.auth?.basic?.username,
        password:
            get(PLAYGROUND_AUTH_STATE_ATOM).basicAuth?.password ??
            get(PLAYGROUND_RESOLVED_STATE_ATOM)?.auth?.basic?.password
    }),
    (_get, set, update: SetStateAction<Partial<PlaygroundAuthStateBasicAuth>> | typeof RESET) => {
        set(PLAYGROUND_AUTH_STATE_ATOM, (prev) => {
            if (prev == null) {
                return {};
            }

            const { basicAuth: prevBasicAuth, ...rest } = prev;

            const nextBasicAuth =
                typeof update === "function"
                    ? update(prevBasicAuth ?? PLAYGROUND_AUTH_STATE_BASIC_AUTH_INITIAL)
                    : update;

            if (nextBasicAuth === RESET) {
                return rest;
            }

            return {
                ...rest,
                basicAuth: {
                    username: "",
                    password: "",
                    ...prevBasicAuth,
                    ...nextBasicAuth
                }
            };
        });
    }
);

export const PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_ATOM = atom(
    (get) => get(PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM).username,
    (_get, set, update: SetStateAction<string> | typeof RESET) => {
        set(PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM, ({ username: prevUsername, ...rest }) => {
            const nextUsername = typeof update === "function" ? update(prevUsername ?? "") : update;

            if (nextUsername === RESET) {
                return rest;
            }

            return { ...rest, username: nextUsername };
        });
    }
);

export const PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_ATOM = atom(
    (get) => get(PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM).password,
    (_get, set, update: SetStateAction<string> | typeof RESET) => {
        set(PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM, ({ password: prevPassword, ...rest }) => {
            const nextPassword = typeof update === "function" ? update(prevPassword ?? "") : update;

            if (nextPassword === RESET) {
                return rest;
            }

            return { ...rest, password: nextPassword };
        });
    }
);

export const PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_IS_RESETTABLE_ATOM = atom((get) => {
    const inputBasicAuth = get(PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM);
    const injectedBasicAuth = get(PLAYGROUND_RESOLVED_STATE_ATOM)?.auth?.basic;
    return injectedBasicAuth != null && inputBasicAuth.username !== injectedBasicAuth.username;
});

export const PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_IS_RESETTABLE_ATOM = atom((get) => {
    const inputBasicAuth = get(PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM);
    const injectedBasicAuth = get(PLAYGROUND_RESOLVED_STATE_ATOM)?.auth?.basic;
    return injectedBasicAuth != null && inputBasicAuth.password !== injectedBasicAuth.password;
});

export const PLAYGROUND_AUTH_STATE_OAUTH_ATOM = atom(
    (get) => get(PLAYGROUND_AUTH_STATE_ATOM).oauth ?? PLAYGROUND_AUTH_STATE_OAUTH_INITIAL,
    (_get, set, update: SetStateAction<PlaygroundAuthStateOAuth> | typeof RESET) => {
        set(PLAYGROUND_AUTH_STATE_ATOM, ({ oauth: prevOauth, ...rest }) => {
            const nextOauth =
                typeof update === "function" ? update(prevOauth ?? PLAYGROUND_AUTH_STATE_OAUTH_INITIAL) : update;

            if (nextOauth === RESET) {
                return rest;
            }

            return { ...rest, oauth: nextOauth };
        });
    }
);

export const PLAYGROUND_AUTH_FORM_OPEN_ATOM = atom<boolean>(false);

const playgroundFormStateFamily = atomFamily((nodeId: FernNavigation.NodeId) => {
    const formStateAtom = atomWithStorage<PlaygroundRequestFormState | undefined>(nodeId, undefined, undefined, {
        getOnInit: true
    });
    formStateAtom.debugLabel = `playground-form-state:${nodeId}`;
    return formStateAtom;
});

export const usePlaygroundFormStateAtom = (
    nodeId: FernNavigation.NodeId
): WritableAtom<
    PlaygroundRequestFormState | undefined,
    [SetStateAction<PlaygroundRequestFormState | undefined>],
    void
> => {
    const formStateAtom = playgroundFormStateFamily(nodeId);

    useEffect(() => {
        return () => {
            playgroundFormStateFamily.remove(nodeId);
        };
    }, [formStateAtom, nodeId]);

    return formStateAtom;
};

export function usePlaygroundEndpointFormState(
    ctx: EndpointContext
): [PlaygroundEndpointRequestFormState, Dispatch<SetStateAction<PlaygroundEndpointRequestFormState>>] {
    const formStateAtom = playgroundFormStateFamily(ctx.node.id);
    const formState = useAtomValue(formStateAtom);
    const domain = useDomain();

    const fernUserPlaygroundState = useResolvedPlaygroundState();

    const firstExample =
        domain.includes("twelvelabs") || domain.includes("spscommerce") ? undefined : ctx.endpoint.examples?.[0];

    return [
        formState?.type === "endpoint"
            ? formState
            : getInitialEndpointRequestFormStateWithExample(ctx, firstExample, fernUserPlaygroundState),
        useAtomCallback(
            useCallbackOne(
                (get, set, update: SetStateAction<PlaygroundEndpointRequestFormState>) => {
                    const currentFormState = get(formStateAtom);
                    const newFormState =
                        typeof update === "function"
                            ? update(
                                  currentFormState?.type === "endpoint"
                                      ? currentFormState
                                      : getInitialEndpointRequestFormStateWithExample(
                                            ctx,
                                            firstExample,
                                            fernUserPlaygroundState
                                        )
                              )
                            : update;
                    set(formStateAtom, newFormState);
                },
                [formStateAtom, ctx, fernUserPlaygroundState, firstExample]
            )
        )
    ];
}

export function usePlaygroundWebsocketFormState(
    context: WebSocketContext
): [PlaygroundWebSocketRequestFormState, Dispatch<SetStateAction<PlaygroundWebSocketRequestFormState>>] {
    const formStateAtom = playgroundFormStateFamily(context.node.id);
    const formState = useAtomValue(playgroundFormStateFamily(context.node.id));

    const fernUserPlaygroundState = useResolvedPlaygroundState();

    return [
        formState?.type === "websocket"
            ? formState
            : getInitialWebSocketRequestFormState(context, fernUserPlaygroundState),
        useAtomCallback(
            useCallbackOne(
                (get, set, update: SetStateAction<PlaygroundWebSocketRequestFormState>) => {
                    const currentFormState = get(formStateAtom);
                    const newFormState =
                        typeof update === "function"
                            ? update(
                                  currentFormState?.type === "websocket"
                                      ? currentFormState
                                      : getInitialWebSocketRequestFormState(context, fernUserPlaygroundState)
                              )
                            : update;
                    set(formStateAtom, newFormState);
                },
                [formStateAtom, context, fernUserPlaygroundState]
            )
        )
    ];
}

// use to track initial environment-specific state of auth
export function useResolvedPlaygroundState() {
    return useAtomValue(PLAYGROUND_RESOLVED_STATE_ATOM);
}

export const PLAYGROUND_INITIAL_STATE_ATOM = atom((get) => {
    const user = get(fernUserAtom);
    return user?.playground?.initial_state;
});

export const PLAYGROUND_ENV_STATE_ATOM = atom((get) => {
    const user = get(fernUserAtom);
    return user?.playground?.env_state;
});
