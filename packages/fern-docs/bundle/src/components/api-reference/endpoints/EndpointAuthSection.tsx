import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";

import { t } from "@fern-docs/i18n";
import { FernCollapseWithButtonUncontrolled } from "../type-definitions/FernCollapseWithButtonUncontrolled";
import { PropertyRenderer } from "../type-definitions/ObjectProperty";
import { WithSeparator } from "../type-definitions/TypeDefinitionDetails";
import { EndpointSection } from "./EndpointSection";

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

function AuthSchemeVariant({ auth, lang }: { auth: ApiDefinition.AuthScheme; lang: string }) {
    const display = authSchemeToDisplay(auth, lang);
    return (
        <PropertyRenderer
            name={display.name}
            description={display.description}
            availability={display.availability}
            typeShorthand={
                <span className="fern-api-property-type text-(color:--grayscale-a11) font-mono text-xs">
                    {display.typeShorthand}
                </span>
            }
        />
    );
}

export function EndpointAuthSection({ auths, lang }: { auths: ApiDefinition.AuthScheme[]; lang: string }) {
    if (auths.length === 0) {
        return null;
    }

    return (
        <EndpointSection title={t(lang).apiReference.authentication}>
            <FernCollapseWithButtonUncontrolled
                showText={`Show ${auths.length} ${auths.length === 1 ? "method" : "methods"}`}
                hideText={`Hide ${auths.length} ${auths.length === 1 ? "method" : "methods"}`}
            >
                <WithSeparator separatorText={auths.length > 1 ? "OR" : undefined}>
                    {auths.map((auth, index) => (
                        <AuthSchemeVariant key={index} auth={auth} lang={lang} />
                    ))}
                </WithSeparator>
            </FernCollapseWithButtonUncontrolled>
        </EndpointSection>
    );
}
