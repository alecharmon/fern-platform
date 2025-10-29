"use client";

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { FernButton } from "@fern-docs/components/FernButton";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernSegmentedControl } from "@fern-docs/components/FernSegmentedControl";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useAtom } from "jotai";
import { HelpCircle, Key, User } from "lucide-react";
import { type ReactElement, useState } from "react";

import { i18n } from "@/constants";
import { Callout } from "@/mdx/components/callout";
import { PLAYGROUND_AUTH_STATE_OAUTH_ATOM, usePlaygroundEndpointFormState } from "@/state/playground";
import { PlaygroundEndpointForm } from "../endpoint";
import { PasswordInputGroup } from "../PasswordInputGroup";
import { oAuthClientCredentialReferencedEndpointLoginFlow } from "../utils/oauth";
import { usePlaygroundBaseUrl } from "../utils/select-environment";
import { useClosePlaygroundAuthorizationFormCard } from "./PlaygroundAuthorizationFormCardRoot";

export function FoundOAuthReferencedEndpointForm({
    context,
    referencedEndpoint,
    disabled
}: {
    /**
     * this must be the OAuth endpoint.
     */
    context: EndpointContext;
    referencedEndpoint: APIV1Read.OAuthClientCredentials.ReferencedEndpoint;
    disabled?: boolean;
}): ReactElement<any> {
    const closeContainer = useClosePlaygroundAuthorizationFormCard();
    const [value, setValue] = useAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);
    const [formState, setFormState] = usePlaygroundEndpointFormState(context);
    const [baseUrl] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);

    const [displayFailedLogin, setDisplayFailedLogin] = useState(false);

    /**
     * TODO: turn this into a loadable (suspense)
     */
    const oAuthClientCredentialLogin = async () => {
        setValue((prev) => ({ ...prev, isLoggingIn: true }));
        await oAuthClientCredentialReferencedEndpointLoginFlow({
            formState,
            endpoint: context.endpoint,
            referencedEndpoint,
            baseUrl,
            setValue,
            closeContainer,
            setDisplayFailedLogin
        });
        setValue((prev) => ({ ...prev, isLoggingIn: false }));
    };

    const authenticationOptions: FernDropdown.Option[] = [
        {
            type: "value",
            value: "credentials",
            label: i18n.auth.credentials,
            icon: <User />
        },
        { type: "value", value: "token", label: i18n.auth.bearerToken, icon: <Key /> }
    ];

    return value.isLoggingIn ? (
        <li className="-mx-4 flex flex-1 items-center justify-center space-y-2 p-4 pt-8">{i18n.status.loading}</li>
    ) : (
        <>
            <li className="-mx-4 space-y-2 p-4 pb-2">
                <FernSegmentedControl
                    options={authenticationOptions}
                    onValueChange={(value: string) => {
                        if (value != null && value.length > 0) {
                            setValue((prev) => ({
                                ...prev,
                                selectedInputMethod: value as "credentials" | "token"
                            }));
                        }
                    }}
                    value={value.selectedInputMethod}
                    disabled={disabled}
                />
            </li>

            {value.selectedInputMethod === "credentials" ? (
                <>
                    <li className="-mx-4 space-y-2 p-4">
                        <label className="inline-flex flex-wrap items-baseline">
                            <span className="font-mono text-sm">{i18n.auth.oauthClientCredentialsLogin}</span>
                        </label>
                        <PlaygroundEndpointForm
                            context={context}
                            formState={formState}
                            setFormState={setFormState}
                            ignoreHeaders={true}
                        />
                    </li>
                    {displayFailedLogin && <Callout intent="error">{i18n.auth.failedToLoginWithCredentials}</Callout>}
                    {value.isLoggedIn && (
                        <li className="-mx-4 space-y-2 p-4 pt-0">
                            <FernTooltipProvider>
                                <div className="flex min-w-0 flex-1 shrink items-center justify-between gap-2">
                                    <label className="inline-flex items-baseline gap-2 truncate">
                                        <span className="inline-flex font-mono text-sm">
                                            {i18n.auth.generatedOAuthToken}
                                            <FernTooltip content={i18n.auth.bearerTokenGenerated}>
                                                <HelpCircle className="text-(color:--grayscale-a11) ml-2 size-4 self-center" />
                                            </FernTooltip>
                                        </span>
                                    </label>
                                </div>
                            </FernTooltipProvider>
                            <PasswordInputGroup
                                value={value.accessToken}
                                disabled={true}
                                className="text-(color:--grayscale-a11)"
                            />
                        </li>
                    )}
                    {value.isLoggedIn && value.accessToken !== value.loggedInStartingToken && (
                        <Callout intent="warning">{i18n.auth.bearerTokenNoLongerValid}</Callout>
                    )}
                </>
            ) : (
                <>
                    <li className="-mx-4 space-y-2 p-4">
                        <label className="inline-flex flex-wrap items-baseline">
                            <span className="font-mono text-sm">{i18n.auth.userSuppliedBearerToken}</span>
                        </label>

                        <PasswordInputGroup
                            onValueChange={(newValue: string) =>
                                setValue((prev) => ({
                                    ...prev,
                                    userSuppliedAccessToken: newValue
                                }))
                            }
                            value={value.userSuppliedAccessToken}
                            autoComplete="off"
                            data-1p-ignore="true"
                            disabled={disabled}
                        />
                    </li>
                </>
            )}
            <li className="flex justify-end pt-4">
                {value.selectedInputMethod === "credentials" && (
                    <FernButton
                        text={value.isLoggedIn ? i18n.buttons.refreshBearerToken : i18n.buttons.fetchBearerToken}
                        intent="primary"
                        onClick={() => {
                            void (async () => {
                                try {
                                    await oAuthClientCredentialLogin();
                                } catch (e) {
                                    console.error("Failed to login:", e);
                                }
                            })();
                        }}
                        disabled={disabled}
                    />
                )}
            </li>
        </>
    );
}
