import * as Sentry from "@sentry/nextjs";

import { baseConfig } from "./sentry.base.config";

Sentry.init({ dsn: process.env.SENTRY_DSN, ...baseConfig });
Sentry.metrics.count("user_action", 1);
Sentry.metrics.distribution("api_response_time", 150);
