import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { SemanticBadge } from "@fern-docs/components/badges";
import { Button } from "@fern-docs/components/button";
import { t } from "@fern-docs/i18n";
import { useAtomValue } from "jotai";
import { Key } from "lucide-react";
import type { ReactElement } from "react";
import { PLAYGROUND_AUTH_STATE_ATOM } from "@/state/playground";
import type { PlaygroundAuthState } from "../types";
import { isMultiAuthToken } from "../utils/parse-auth-options";

interface PlaygroundCardTriggerManualProps {
    auth: APIV1Read.ApiAuth;
    disabled: boolean;
    toggleOpen: () => void;
    isOpen: boolean;
    lang: string;
}

export function PlaygroundCardTriggerManual({
    auth,
    disabled,
    toggleOpen,
    isOpen,
    lang
}: PlaygroundCardTriggerManualProps): ReactElement<any> | false {
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);

    if (isMultiAuthToken(authState.bearerAuth?.token ?? "")) {
        return <></>;
    }

    const authButtonCopy = visitDiscriminatedUnion(auth)._visit({
        bearerAuth: () => t(lang).auth.enterBearerToken,
        basicAuth: () => t(lang).auth.enterUsernameAndPassword,
        header: () => t(lang).auth.enterCredentials,
        oAuth: () => t(lang).auth.enterCredentials,
        _other: () => t(lang).auth.enterCredentials
    });

    const authed = isAuthed(auth, authState);

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
            {authed ? (
                <SemanticBadge intent="success" className="ml-auto">
                    {t(lang).apiReference.authenticated}
                </SemanticBadge>
            ) : (
                <SemanticBadge intent="danger" className="ml-auto">
                    {t(lang).apiReference.notAuthenticated}
                </SemanticBadge>
            )}
        </Button>
    );
}

function isEmpty(str: string | undefined): boolean {
    return str == null || str.trim().length === 0;
}

function isAuthed(auth: APIV1Read.ApiAuth, authState: PlaygroundAuthState): boolean {
    return visitDiscriminatedUnion(auth)._visit({
        bearerAuth: () => !isEmpty(authState.bearerAuth?.token.trim()),
        basicAuth: () =>
            !isEmpty(authState.basicAuth?.username.trim()) && !isEmpty(authState.basicAuth?.password.trim()),
        header: (header) => !isEmpty(authState.header?.headers[header.headerWireValue]?.trim()),
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
