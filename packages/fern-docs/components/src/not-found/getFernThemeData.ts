import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import { logger } from "@fern-api/ui-core-utils/logger";

export async function getFernThemeData() {
    const domain = process.env.NEXT_PUBLIC_FERN_DOMAIN ?? "buildwithfern.com";
    try {
        const loader = await createCachedDocsLoader(domain, domain, undefined, {
            roles: [EVERYONE_ROLE]
        });

        const [colors, layout, fonts, theme] = await Promise.all([
            loader.getColors(),
            loader.getLayout(),
            loader.getFonts(),
            loader.getTheme()
        ]);

        return { domain, colors, layout, fonts, theme };
    } catch (error) {
        logger.warn(`[getFernThemeData] Failed to fetch theme for ${domain}`, error);
        return null;
    }
}
