import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type { AuthOptionEntry, AuthSchemeWithKey } from "@fern-api/fdr-sdk/api-definition";
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
    allAuthOptionEntries?: AuthOptionEntry[];
}

export function PlaygroundCardTriggerManual({
    auth,
    disabled,
    toggleOpen,
    isOpen,
    lang,
    allAuthsWithKeys = [],
    allAuthOptionEntries = []
}: PlaygroundCardTriggerManualProps): ReactElement<any> | false {
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);
    const setSelectedAuthType = useSetAtom(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);

    const currentAuthWithKey = allAuthsWithKeys.find((a) => a.scheme === auth);
    const authKey = currentAuthWithKey ? getAuthKey(currentAuthWithKey) : "unknown";

    if (isMultiAuthToken(authState.bearerAuth?.token ?? "")) {
        return <></>;
    }

    const getAuthButtonCopy = (authItem: APIV1Read.ApiAuth) =>
        visitDiscriminatedUnion(authItem)._visit({
            bearerAuth: (bearer) => {
                return bearer.tokenName
                    ? `${t(lang).auth.enterBearerToken} (${bearer.tokenName})`
                    : t(lang).auth.enterBearerToken;
            },
            basicAuth: () => t(lang).auth.enterUsernameAndPassword,
            header: (header) => {
                return `${t(lang).auth.enterCredentials} (${header.headerWireValue})`;
            },
            oAuth: () => t(lang).auth.enterCredentials,
            _other: () => t(lang).auth.enterCredentials
        });

    const authButtonCopy = getAuthButtonCopy(auth);
    const authed = isAuthed(auth, authState, authKey);

    const authEntries =
        allAuthOptionEntries.length > 0
            ? allAuthOptionEntries
            : allAuthsWithKeys.map((authWithKey) => ({
                  key: getAuthKey(authWithKey),
                  schemeIds: [authWithKey.key],
                  schemes: [authWithKey.scheme],
                  label: authSchemeToDisplay(authWithKey.scheme, lang).name
              }));

    const hasMultipleAuths = authEntries.length > 1;

    const dropdownValue = selectedAuthType ?? authEntries[0]?.key ?? authKey;

    const authDisplays = authEntries.map((entry) => entry.schemes.map((scheme) => authSchemeToDisplay(scheme, lang)));

    const nameCounts = new Map<string, number>();
    authDisplays.flat().forEach(({ name }) => {
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    });

    const dropdownOptions = authEntries.map((entry, entryIndex) => {
        const displays = authDisplays[entryIndex];

        if (displays.length === 1) {
            const display = displays[0];
            const needsQualifier = (nameCounts.get(display.name) || 0) > 1;
            const label = needsQualifier ? `${display.name} (${display.typeShorthand})` : display.name;

            return {
                type: "value" as const,
                label,
                helperText: linkifyText(display.description),
                value: entry.key
            };
        }

        const label = (
            <div key={entry.key} className="flex flex-col gap-0.5">
                {displays.map((display, i) => {
                    const needsQualifier = (nameCounts.get(display.name) || 0) > 1;
                    const name = needsQualifier ? `${display.name} (${display.typeShorthand})` : display.name;
                    return <div key={i}>{name}</div>;
                })}
            </div>
        );

        const helperText = (
            <div key={`${entry.key}-helper`} className="flex flex-col gap-1">
                {displays.map((display, i) => (
                    <div key={i}>{linkifyText(display.description)}</div>
                ))}
            </div>
        );

        return {
            type: "value" as const,
            label,
            helperText,
            value: entry.key
        };
    });

    const handleAuthChange = (authKey: string) => {
        setSelectedAuthType(authKey);
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
                            value={dropdownValue}
                            options={dropdownOptions}
                            onValueChange={handleAuthChange}
                            lang={lang}
                            contentProps={{ style: { minWidth: "360px" } }}
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
