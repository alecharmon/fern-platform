import type { FdrAPI } from "@fern-api/fdr-sdk";

export class DefinitionObjectFactory {
    public static createDocsDefinition(): FdrAPI.docs.v1.read.DocsDefinition {
        return {
            pages: {},
            apis: {},
            apisV2: {},
            apiNameToId: undefined,
            files: {},
            filesV2: {},
            config: {
                colorsV3: {
                    type: "dark",
                    accentPrimary: { r: 0, g: 0, b: 0, a: 1 },
                    background: { type: "solid", r: 0, g: 0, b: 0, a: 1 },
                    logo: undefined,
                    backgroundImage: undefined,
                    border: undefined,
                    sidebarBackground: undefined,
                    headerBackground: undefined,
                    cardBackground: undefined
                },
                navbarLinks: [],
                navigation: { items: [], landingPage: undefined },
                hideNavLinks: undefined,
                root: undefined,
                title: undefined,
                defaultLanguage: undefined,
                languages: undefined,
                announcement: undefined,
                footerLinks: undefined,
                logoHeight: undefined,
                logoHref: undefined,
                logoRightText: undefined,
                favicon: undefined,
                metadata: undefined,
                redirects: undefined,
                layout: undefined,
                theme: undefined,
                settings: undefined,
                typographyV2: undefined,
                analyticsConfig: undefined,
                integrations: undefined,
                css: undefined,
                js: undefined,
                header: undefined,
                footer: undefined,
                aiChatConfig: undefined,
                pageActions: undefined,
                editThisPageLaunch: undefined
            },
            jsFiles: undefined,
            id: undefined
        };
    }
}
