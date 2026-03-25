import * as Sentry from "@sentry/nextjs";

import { baseConfig } from "./sentry.base.config";

Sentry.init({ dsn: process.env.SENTRY_DSN, ...baseConfig });
