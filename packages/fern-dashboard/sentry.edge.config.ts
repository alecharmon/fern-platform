import * as Sentry from "@sentry/nextjs";

import { isProduction } from "@/utils/environment";

import { baseConfig } from "./sentry.base.config";

if (isProduction()) {
    Sentry.init({ ...baseConfig });
}
