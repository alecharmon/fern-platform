import { mapValues } from "es-toolkit/object";

import { ApiDefinition, DocsV1Read, FdrClient, FernNavigation } from "@fern-api/fdr-sdk";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";

export interface LoadDocsWithUrlPayload {
    /**
     * FDR environment to use. (either `https://registry-dev2.buildwithfern.com` or `https://registry.buildwithfern.com`)
     */
    environment: string;

    /**
     * The shared secret token use to authenticate with FDR.
     */
    fernToken: string;

    /**
     * The domain to load docs for.
     */
    domain: string;

    isBatchStreamToggleDisabled?: boolean;
    isApiScrollingDisabled?: boolean;
    useJavaScriptAsTypeScript?: boolean;
    alwaysEnableJavaScriptFetch?: boolean;
    usesApplicationJsonInFormDataValue?: boolean;
}

interface LoadDocsWithUrlResponse {
    org_id: FernNavigation.OrgId;
    root: FernNavigation.RootNode;
    pages: Record<FernNavigation.PageId, string>;
    apis: Record<ApiDefinition.ApiDefinitionId, ApiDefinition.ApiDefinition>;
    domain: string;
}

export async function loadDocsWithUrl(payload: LoadDocsWithUrlPayload): Promise<LoadDocsWithUrlResponse> {
    const client = new FdrClient({
        environment: payload.environment,
        token: payload.fernToken
    });

    const docs = await client.docs.v2.read.getDocsForUrl({
        url: ApiDefinition.Url(payload.domain)
    });

    if (!docs.ok) {
        throw new Error(`Failed to get docs for ${payload.domain}: ${docs.error.error}`);
    }

    const res = await client.docs.v2.read.getOrganizationForUrl({
        url: ApiDefinition.Url(payload.domain)
    });
    if (!res.ok) {
        throw new Error(`Failed to get org for ${payload.domain}: ${res.error.error}`);
    }
    const org_id = res.body;

    const domain = new URL(withDefaultProtocol(payload.domain)).host;

    const root = FernNavigation.utils.toRootNode(
        docs.body,
        payload.isBatchStreamToggleDisabled ?? false,
        payload.isApiScrollingDisabled ?? false
    );

    const pages = retrieveMarkdownFromPages(docs.body.definition.pages);

    const apis = {
        ...mapValues(docs.body.definition.apis, (api) =>
            ApiDefinition.ApiDefinitionV1ToLatest.from(api, {
                useJavaScriptAsTypeScript: payload.useJavaScriptAsTypeScript ?? false,
                alwaysEnableJavaScriptFetch: payload.alwaysEnableJavaScriptFetch ?? false,
                usesApplicationJsonInFormDataValue: payload.usesApplicationJsonInFormDataValue ?? false
            }).migrate()
        ),
        ...docs.body.definition.apisV2
    };

    return { org_id, root, pages, apis, domain };
}

function retrieveMarkdownFromPages(pages: Record<FernNavigation.PageId, DocsV1Read.PageContent>) {
    return mapValues(pages, (page) => page.markdown);
}
