"use server";

import { z } from "zod";

import { fernToken_admin } from "@fern-api/docs-server";

import { getDocsUrlMetadata } from "../api/utils/getDocsUrlMetadata";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import getDocsSitesForOrg from "../services/dal/fdr/getDocsSitesForOrg";
import { getAnalyticsService } from "../services/posthog";
import { DateRangeOptions } from "../services/posthog/types";

// Schema for web analytics request
const GetWebAnalyticsSchema = z.object({
  docsUrl: z.string(), // Accept any string, we'll decode and validate later
  dateRange: z
    .union([
      z.object({
        type: z.literal("last_n_days"),
        days: z.number().int().min(1).max(365),
      }),
      z.object({
        type: z.literal("last_n_weeks"),
        weeks: z.number().int().min(1).max(52),
      }),
      z.object({
        type: z.literal("last_n_months"),
        months: z.number().int().min(1).max(24),
      }),
      z.object({
        type: z.literal("custom_range"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
      }),
    ])
    .optional(),
  includeInternal: z.boolean().optional(),
  groupBy: z.number().optional(), // Number of days to group by (7 for weekly, 30 for monthly)
});

export type GetWebAnalyticsRequest = z.infer<typeof GetWebAnalyticsSchema>;

export interface WebAnalyticsMetrics {
  visitors: number;
  pageViews: number;
  sessions: number;
}

export interface GetWebAnalyticsResponse {
  metrics: WebAnalyticsMetrics;
  baseSiteUrl: string;
  dateRange: DateRangeOptions;
}

function getBaseDomain(rawUrl: string) {
  const decodedUrl = decodeURIComponent(rawUrl);
  let baseDomain: string;
  try {
    const url = new URL(
      decodedUrl.startsWith("http") ? decodedUrl : `https://${decodedUrl}`
    );
    baseDomain = url.hostname;
  } catch {
    // If URL parsing fails, assume it's already just a domain
    baseDomain = decodedUrl.split("/")[0] ?? "";
  }

  if (!baseDomain) {
    throw new Error("Invalid docs URL");
  }

  return baseDomain;
}

async function verifyDomainAccess(url: string) {
  const session = await getCurrentSessionOrThrow();

  // Decode the URL (handles %2F -> /)
  const decodedUrl = decodeURIComponent(url);

  const docsMetadata = await getDocsUrlMetadata({
    url: decodedUrl,
    token: fernToken_admin() ?? session.accessToken,
  });

  const baseDomain = getBaseDomain(decodedUrl);
  // Get all organizations the user has access to
  if (!docsMetadata.ok || !docsMetadata.body.org) {
    throw new Error(`Invalid docs URL`);
  }

  // Verify user has access to this org's docs
  const orgSites = await getDocsSitesForOrg({
    token: session.accessToken,

    // @ts-expect-error - OrgId vs Auth0OrgName type mismatch
    orgName: docsMetadata.body.org,
  });
  if (!orgSites.ok) {
    throw new Error("Failed to fetch organization sites");
  }
  const hasAccess = orgSites.docsSites.some(
    (site) => site.mainUrl.domain === baseDomain
  );

  return hasAccess;
}

/**
 * Server action to fetch web analytics from PostHog
 * This is different from getDomainAnalytics which uses FAI
 */
export async function getWebAnalytics(
  request: GetWebAnalyticsRequest
): Promise<GetWebAnalyticsResponse> {
  // Validate input
  const validated = GetWebAnalyticsSchema.parse(request);

  // Get current session
  const session = await getCurrentSessionOrThrow();
  const userId = session.user.sub;

  const hasAccess = await verifyDomainAccess(validated.docsUrl);

  if (!hasAccess) {
    throw new Error("You don't have access to analytics for this docs site");
  }

  // Default date range if not provided
  const dateRange = validated.dateRange || {
    type: "last_n_days" as const,
    days: 7,
  };

  const baseDomain = getBaseDomain(validated.docsUrl);

  // Initialize PostHog analytics service
  const analytics = getAnalyticsService({
    userId,
    baseSiteUrl: baseDomain,
  });

  // Fetch metrics from PostHog
  const metrics = await analytics.getMetrics({
    dateRange,
    includeInternal: validated.includeInternal,
  });

  return {
    metrics: {
      visitors: metrics.visitors,
      pageViews: metrics.pageViews,
      sessions: metrics.sessions,
    },
    baseSiteUrl: baseDomain,
    dateRange,
  };
}

/**
 * Server action to fetch page views by day from PostHog
 */
export async function getPageViewsByDay(
  request: GetWebAnalyticsRequest
): Promise<{ timeSeries: { date: string; value: number }[] }> {
  // Validate input
  const validated = GetWebAnalyticsSchema.parse(request);

  // Get current session
  const session = await getCurrentSessionOrThrow();
  const userId = session.user.sub;

  // Verify access using the composable function
  const hasAccess = await verifyDomainAccess(validated.docsUrl);
  if (!hasAccess) {
    throw new Error("You don't have access to analytics for this docs site");
  }

  // Default date range if not provided
  const dateRange = validated.dateRange || {
    type: "last_n_days" as const,
    days: 7,
  };

  const baseDomain = getBaseDomain(validated.docsUrl);

  // Initialize PostHog analytics service
  const analytics = getAnalyticsService({
    userId,
    baseSiteUrl: baseDomain,
  });

  // Fetch page views time series from PostHog
  const timeSeries = await analytics.getPageViewsTimeSeries({
    dateRange,
    includeInternal: validated.includeInternal,
    groupBy: validated.groupBy,
  });

  return { timeSeries };
}

/**
 * Server action to fetch visitors by day from PostHog
 */
export async function getVisitorsByDay(
  request: GetWebAnalyticsRequest
): Promise<{ timeSeries: { date: string; value: number }[] }> {
  // Validate input
  const validated = GetWebAnalyticsSchema.parse(request);

  // Get current session
  const session = await getCurrentSessionOrThrow();
  const userId = session.user.sub;

  // Verify access using the composable function
  const hasAccess = await verifyDomainAccess(validated.docsUrl);
  if (!hasAccess) {
    throw new Error("You don't have access to analytics for this docs site");
  }

  // Default date range if not provided
  const dateRange = validated.dateRange || {
    type: "last_n_days" as const,
    days: 7,
  };

  const baseDomain = getBaseDomain(validated.docsUrl);

  // Initialize PostHog analytics service
  const analytics = getAnalyticsService({
    userId,
    baseSiteUrl: baseDomain,
  });

  // Fetch visitors time series from PostHog
  const timeSeries = await analytics.getVisitorsTimeSeries({
    dateRange,
    includeInternal: validated.includeInternal,
    groupBy: validated.groupBy,
  });

  return { timeSeries };
}
