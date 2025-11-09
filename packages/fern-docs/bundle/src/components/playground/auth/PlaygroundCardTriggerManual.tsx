import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type { AuthSchemeWithKey } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { SemanticBadge } from "@fern-docs/components/badges";
import { Button } from "@fern-docs/components/button";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { t } from "@fern-docs/i18n";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, Key } from "lucide-react";
import type { ReactElement } from "react";
import { PLAYGROUND_AUTH_STATE_ATOM, PLAYGROUND_SELECTED_AUTH_TYPE_ATOM } from "@/state/playground";
import type { PlaygroundAuthState } from "../types";
import { getAuthKey } from "../utils";
import { isMultiAuthToken } from "../utils/parse-auth-options";
import { linkifyText } from "./linkify-text";
import { getHeaderStorageKey } from "./PlaygroundHeaderAuthForm";

interface AuthSchemeDisplay {
    name: string;
    description: string;
    availability: ApiDefinition.Availability | undefined;
    typeShorthand: string;
}

function authSchemeToDisplay(auth: ApiDefinition.AuthScheme, lang: string): AuthSchemeDisplay {
    return visitDiscriminatedUnion(auth)._visit<AuthSchemeDisplay>({
        basicAuth: (basicAuth) => ({
            name: "Authorization",
            description: basicAuth.description ?? t(lang).authTypes.basicAuth,
            availability: undefined,
            typeShorthand: "Basic"
        }),
        bearerAuth: (bearerAuth) => ({
            name: "Authorization",
            description: bearerAuth.description ?? t(lang).authTypes.bearerAuth,
            availability: undefined,
            typeShorthand: "Bearer"
        }),
        header: (value) => ({
            name: value.headerWireValue,
            description:
                value.description ??
                (value.prefix != null
                    ? `Header authentication of the form \`${value.prefix} <token>\``
                    : t(lang).authTypes.apiKey),
            availability: undefined,
            typeShorthand: value.prefix || "string"
        }),
        oAuth: (value) =>
            visitDiscriminatedUnion(value.value, "type")._visit({
                clientCredentials: (clientCredentialsValue) =>
                    visitDiscriminatedUnion(clientCredentialsValue.value, "type")._visit({
                        referencedEndpoint: (oauth) => ({
                            name: clientCredentialsValue.value.headerName || "Authorization",
                            description:
                                oauth.description ??
                                `OAuth authentication of the form \`${clientCredentialsValue.value.tokenPrefix ? `${clientCredentialsValue.value.tokenPrefix ?? "Bearer"} ` : ""}<token>\`.`,
                            availability: undefined,
                            typeShorthand: clientCredentialsValue.value.tokenPrefix || "Bearer"
                        })
                    })
            })
    });
}

interface PlaygroundCardTriggerManualProps {
    auth: APIV1Read.ApiAuth;
    disabled: boolean;
    toggleOpen: () => void;
    isOpen: boolean;
    lang: string;
    allAuthsWithKeys?: AuthSchemeWithKey[];
}

export function PlaygroundCardTriggerManual({
    auth,
    disabled,
    toggleOpen,
    isOpen,
    lang,
    allAuthsWithKeys = []
}: PlaygroundCardTriggerManualProps): ReactElement<any> | false {
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    const setSelectedAuthType = useSetAtom(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);

    // Find the auth key for the current auth scheme
    const currentAuthWithKey = allAuthsWithKeys.find((a) => a.scheme === auth);
    const authKey = currentAuthWithKey ? getAuthKey(currentAuthWithKey) : "unknown";

    if (isMultiAuthToken(authState.bearerAuth?.token ?? "")) {
        return <></>;
    }

    const getAuthButtonCopy = (authItem: APIV1Read.ApiAuth) =>
        visitDiscriminatedUnion(authItem)._visit({
            bearerAuth: (bearer) => {
                // Show custom token name if provided
                return bearer.tokenName
                    ? `${t(lang).auth.enterBearerToken} (${bearer.tokenName})`
                    : t(lang).auth.enterBearerToken;
            },
            basicAuth: () => t(lang).auth.enterUsernameAndPassword,
            header: (header) => {
                // Always show header name since it's useful context
                return `${t(lang).auth.enterCredentials} (${header.headerWireValue})`;
            },
            oAuth: () => t(lang).auth.enterCredentials,
            _other: () => t(lang).auth.enterCredentials
        });

    const authButtonCopy = getAuthButtonCopy(auth);
    const authed = isAuthed(auth, authState, authKey);
    const hasMultipleAuths = allAuthsWithKeys.length > 1;

    // Generate display info for all auth schemes using the same function as the endpoint page
    const authDisplays = allAuthsWithKeys.map((authWithKey) => ({
        authWithKey,
        display: authSchemeToDisplay(authWithKey.scheme, lang)
    }));

    // Check if there are duplicate names that need qualifiers
    const nameCounts = new Map<string, number>();
    authDisplays.forEach(({ display }) => {
        nameCounts.set(display.name, (nameCounts.get(display.name) || 0) + 1);
    });

    // Use the auth keys from the API definition - guaranteed to be unique
    const dropdownOptions = authDisplays.map(({ authWithKey, display }) => {
        const needsQualifier = (nameCounts.get(display.name) || 0) > 1;
        const label = needsQualifier ? `${display.name} (${display.typeShorthand})` : display.name;

        return {
            type: "value" as const,
            label,
            helperText: linkifyText(display.description),
            value: getAuthKey(authWithKey)
        };
    });

    const handleAuthChange = (authKey: string) => {
        setSelectedAuthType(authKey);
        // Auto-open the form when switching auth methods
        if (!isOpen) {
            toggleOpen();
        }
    };

    if (hasMultipleAuths) {
        return (
            <Button
                className="w-full px-4 text-left"
                size="lg"
                variant={authed ? "outlineSuccess" : "outlineDanger"}
                disabled={disabled}
                data-state={isOpen ? "open" : "closed"}
                asChild
            >
                <div className="flex w-full items-center gap-2">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <FernDropdown
                            value={authKey}
                            options={dropdownOptions}
                            onValueChange={handleAuthChange}
                            lang={lang}
                        >
                            <button type="button" className="flex items-center gap-2 text-left">
                                <Key className="h-4 w-4" />
                                <span>{authButtonCopy}</span>
                                <ChevronDown className="h-4 w-4" />
                            </button>
                        </FernDropdown>
                    </div>
                    <button
                        type="button"
                        onClick={toggleOpen}
                        className="ml-auto flex flex-1 items-center justify-end"
                        disabled={disabled}
                    >
                        <SemanticBadge intent={authed ? "success" : "danger"}>Edit</SemanticBadge>
                    </button>
                </div>
            </Button>
        );
    }

    return (
        <Button
            className="w-full px-4 text-left"
            size="lg"
            variant={authed ? "outlineSuccess" : "outlineDanger"}
            onClick={toggleOpen}
            disabled={disabled}
            data-state={isOpen ? "open" : "closed"}
        >
            <Key />
            {authButtonCopy}
            <SemanticBadge intent={authed ? "success" : "danger"} className="ml-auto">
                Edit
            </SemanticBadge>
        </Button>
    );
}

function isEmpty(str: string | undefined): boolean {
    return str == null || str.trim().length === 0;
}

function isAuthed(auth: APIV1Read.ApiAuth, authState: PlaygroundAuthState, authKey: string): boolean {
    return visitDiscriminatedUnion(auth)._visit({
        bearerAuth: () => !isEmpty(authState.bearerAuth?.token.trim()),
        basicAuth: () =>
            !isEmpty(authState.basicAuth?.username.trim()) && !isEmpty(authState.basicAuth?.password.trim()),
        header: (header) => {
            const storageKey = getHeaderStorageKey(authKey, header.headerWireValue);
            return !isEmpty(authState.header?.headers[storageKey]?.trim());
        },
        oAuth: () => {
            const authToken =
                authState.oauth?.selectedInputMethod === "credentials"
                    ? authState.oauth?.accessToken
                    : authState.oauth?.userSuppliedAccessToken;
            return authToken ? !isEmpty(authToken.trim()) : false;
        },
        _other: () => false
    });
}
