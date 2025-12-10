import { OrgId } from "../api/generated/api";
import { LOGGER } from "../app/FdrApplication";
import type { CachedDocsResponse } from "../services/docs-cache/DocsDefinitionCache";
import type RedisDocsDefinitionStore from "../services/docs-cache/RedisDocsDefinitionStore";

const HEALTHCHECK_KEY = "https://healthcheck.buildwithfern.com";
const HEALTHCHECK_DOCS_RESPONSE: CachedDocsResponse = {
    dbFiles: {},
    isPrivate: true,
    response: {
        baseUrl: {
            domain: "healthcheck.buildwithfern.com",
            basePath: undefined
        },
        definition: {
            pages: {},
            apis: {},
            apisV2: {},
            config: {
                navigation: {
                    items: [],
                    landingPage: undefined
                },
                root: undefined,
                title: undefined,
                defaultLanguage: undefined,
                languages: undefined,
                announcement: undefined,
                navbarLinks: undefined,
                footerLinks: undefined,
                hideNavLinks: undefined,
                logoHeight: undefined,
                logoHref: undefined,
                logoRightText: undefined,
                favicon: undefined,
                metadata: undefined,
                redirects: undefined,
                colorsV3: undefined,
                layout: undefined,
                theme: undefined,
                settings: undefined,
                typographyV2: undefined,
                analyticsConfig: undefined,
                integrations: undefined,
                css: undefined,
                js: undefined,
                aiChatConfig: undefined,
                pageActions: undefined
            },
            files: {},
            filesV2: {},
            jsFiles: undefined,
            id: undefined
        },
        lightModeEnabled: true,
        orgId: OrgId("fern")
    },
    updatedTime: new Date(),
    version: "v3"
};

export async function checkRedis({ redis }: { redis: RedisDocsDefinitionStore }): Promise<boolean> {
    try {
        const healthcheckURL = new URL(HEALTHCHECK_KEY);
        await redis.set({ url: healthcheckURL, value: HEALTHCHECK_DOCS_RESPONSE });
        const record = await redis.get({ url: healthcheckURL });

        if (record?.response.baseUrl.domain !== healthcheckURL.hostname) {
            return false;
        }

        return true;
    } catch (err) {
        LOGGER.error("Encountered error while retrieving and storing redis entries", err);
        return false;
    }
}
