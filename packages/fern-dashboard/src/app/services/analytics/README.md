# Analytics Service

This directory contains the analytics infrastructure for Fern Dashboard. We use a **three-tier caching architecture** to provide fast, cost-effective analytics data.

## Architecture Overview

```
┌─────────────┐
│   PostHog   │  ← Source of truth (event stream)
│  (Events)   │     Real-time but slow & rate-limited
└─────────────┘
       ↓
┌─────────────┐
│  Redshift   │  ← Data warehouse (PostHog events replicated)
│ (PostgreSQL)│     Fast queries, no rate limits, 3-4 hour delay
└─────────────┘
       ↓
┌─────────────┐
│  Supabase   │  ← Pre-computed cache (daily snapshots)
│   (Cache)   │     Instant response, updated daily via cron
└─────────────┘
```

## Data Flow

### 1. Event Collection (PostHog)
- Users interact with docs sites
- Events are logged to PostHog (e.g., `$pageview`, `api_playground_request_sent`)
- PostHog replicates events to Redshift warehouse every ~3-4 hours

### 2. Cron Job (Daily Cache Refresh)
- Runs via Vercel Cron at `/api/cron/analytics` (daily at 2 AM UTC)
- Queries **Redshift** (not PostHog!) for analytics data
- Pre-computes aggregations for common time periods (7, 14, 30, 90, 180 days)
- Stores results in **Supabase** for instant retrieval

### 3. User Request (Dashboard)
- User loads analytics page
- System checks Supabase cache first
- **Cache hit**: Returns instantly from Supabase
- **Cache miss**: Falls back to Redshift (slower but no rate limits)
- **"Refresh" button**: Forces re-computation from Redshift

## Directory Structure

```
analytics/
├── README.md                  # This file
├── redshift-client.ts         # Redshift connection pool
├── redshift-analytics.ts      # Redshift query service (PRIMARY)
└── cron/                      # Daily cache refresh job
    ├── index.ts               # Public exports
    ├── types.ts               # Shared types
    ├── insert.ts              # Insert/update Supabase cache
    ├── run.ts                 # Orchestration logic
    └── getAllProductionDomains.ts  # Domain discovery
```

## Key Principle: Redshift-First Development

⚠️ **IMPORTANT**: When adding new analytics features, you **MUST** implement them in Redshift first.

### Why Redshift First?

1. **Cron Job Uses Redshift**: The daily cache refresh reads from Redshift, not PostHog
2. **Performance**: Redshift has no rate limits (PostHog API times out on large queries)
3. **Reliability**: Redshift is a direct database query (PostHog API is unreliable for bulk data)
4. **Cost**: PostHog API has rate limits and costs (Redshift is unlimited parallel queries)

### Development Workflow

When adding a new analytics metric:

1. ✅ **Update Redshift Service** (`redshift-analytics.ts`)
   ```typescript
   async getMyNewMetric(options: { dateRange: RedshiftDateRange; limit: number }) {
       const pool = getRedshiftPool();
       // ... Redshift SQL query
   }
   ```

2. ✅ **Update Cron Insert** (`cron/insert.ts`)
   ```typescript
   const myNewMetric = await analytics.getMyNewMetric({ dateRange, limit: 10 });
   // ... add to record object
   ```

3. ✅ **Update Supabase Types** (`../supabase/types.ts`)
   ```typescript
   export interface AnalyticsRecord {
       // ... existing fields
       my_new_metric: MyMetricEntry[] | null;
   }
   ```

4. ✅ **Update Cache Type** (`../posthog/cache.ts`)
   ```typescript
   export interface CachedAnalytics {
       // ... existing fields
       myNewMetric: MyMetricEntry[];
   }
   ```

5. ⚠️ **Optional: Add PostHog Fallback** (`../posthog/analytics.ts`)
   - Only needed for real-time "Refresh" button functionality
   - Not required for cache to work

## Files Overview

### `redshift-client.ts`
PostgreSQL connection pool for Redshift queries.

**Environment Variables:**
- `POSTHOG_REDSHIFT_DB_HOST` - Redshift endpoint
- `POSTHOG_REDSHIFT_DB_USER` - Database user
- `POSTHOG_REDSHIFT_DB_PASSWORD` - Database password

### `redshift-analytics.ts` ⭐ PRIMARY SERVICE
Main analytics query service. All analytics methods should be implemented here first.

**Key Methods:**
- `getMetrics()` - Overall pageviews, visitors, sessions
- `getTopPages()` - Most viewed pages
- `getTopCountries()` - Geographic distribution
- `getChannels()` - Traffic sources (Direct, Organic, Referral, etc.)
- `getDeviceTypes()` - Desktop, Mobile, Tablet breakdown
- `getReferringDomains()` - External sites driving traffic
- `getLLMFileViews()` - llms.txt and markdown file access
- `getAPIExplorerRequests()` - API playground usage with success/failure counts
- `getLLMBotTrafficByProvider()` - AI bot access by provider

**Query Pattern:**
```typescript
const query = `
    SELECT ...
    FROM posthog.events
    WHERE
        event = '$pageview'
        AND (
            properties."$host"::VARCHAR = $1
            OR properties."$host"::VARCHAR = $2
        )
        AND timestamp >= $3
        AND timestamp < $4
    GROUP BY ...
    ORDER BY ...
`;

const result = await pool.query(query, [
    this.domain,
    `www.${this.domain}`,
    startDate.toISOString(),
    endDate.toISOString()
]);
```

### `cron/insert.ts`
Inserts/updates a single analytics record in Supabase by querying Redshift.

**Flow:**
1. Query Redshift for all analytics metrics (parallel)
2. Transform data to match Supabase schema
3. Upsert to `AnalyticsRecord` table (unique on `docs_site, start_date, end_date`)

### `cron/run.ts`
Orchestrates the cron job across all production domains.

**Flow:**
1. Fetch all production domains from FDR
2. Process domains in parallel (10 concurrent)
3. For each domain, process each period (7, 14, 30 days) sequentially
4. Log results and errors

### `cron/getAllProductionDomains.ts`
Discovers all active production docs sites from FDR and Vercel KV.

## API Explorer Requests - Special Case

The API Explorer analytics has a unique challenge:

### Problem
- **Sent Events** (`api_playground_request_sent`) have full request details but no response status
- **Received Events** (`api_playground_request_received`) have response status but different field names

### Solution
We query **both** events and merge them:

```typescript
// Query SENT events for total counts
const sentQuery = `SELECT ... FROM events WHERE event = 'api_playground_request_sent' ...`;

// Query RECEIVED events for response status
const receivedQuery = `SELECT ... FROM events WHERE event = 'api_playground_request_received' ...`;

// Merge by matching: method + endpointRoute + endpointName
// Using docsRoute mapping since received events only have docsRoute
```

**Important Fields:**
- **Sent events**: `endpointRoute` (e.g., `/v1/endpoint/:id`) - clean path template
- **Received events**: `docsRoute` (e.g., `/docs/api/endpoint`) - full docs page URL
- **Received events**: `responseStatus` - HTTP status code (200, 401, 500, etc.)

**Aggregation Key:** `method|endpointRoute|endpointName`
- Groups by the API endpoint template (prevents duplicates from different docs pages)

**Status Counts:**
- `numSuccesses` - Count of 2xx responses
- `numFailures` - Count of 4xx and 5xx responses
- `count` - Total sent requests

**Why Count ≠ Successes + Failures:**
- Not all sent requests get a logged response (timeouts, network errors, streaming endpoints)
- Typically 50-85% of requests are "unaccounted" (no response event)
- This is expected - shows which endpoints have reliability issues

## Common Queries

### Query Redshift Directly
```typescript
import { RedshiftAnalytics } from './redshift-analytics';

const analytics = new RedshiftAnalytics('buildwithfern.com');
const data = await analytics.getTopPages({
    dateRange: {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
    },
    limit: 10
});
```

### Insert Analytics to Cache
```typescript
import { insertAnalyticsForSite } from './cron/insert';

const result = await insertAnalyticsForSite('buildwithfern.com', 7);
```

### Run Full Cron Job
```typescript
import { runAnalyticsCronForAllPeriods } from './cron/run';

const results = await runAnalyticsCronForAllPeriods({ periods: [7, 14, 30] });
```

## Testing

### Test Redshift Queries
```bash
bash scripts/run-test-with-env.sh scripts/test-api-explorer-redshift.ts [domain]
```

Example:
```bash
bash scripts/run-test-with-env.sh scripts/test-api-explorer-redshift.ts elevenlabs.io
```

This tests:
- Event counts (sent vs received)
- Response status distribution
- Aggregation logic
- Sorting by count/successes/failures
- Shows unaccounted request percentage

## Troubleshooting

### Cache Not Updating?
1. Check cron job logs at `/api/cron/analytics`
2. Verify Redshift credentials are set
3. Run manual insert: `insertAnalyticsForSite(domain, period)`

### Queries Timing Out?
- PostHog API times out on large queries → Use Redshift instead
- Redshift has no rate limits or timeouts

### Missing Data?
- Redshift data is 3-4 hours delayed (PostHog replication lag)
- Use "Refresh" button for real-time data (queries PostHog directly)

### Duplicates in Results?
- Ensure aggregation uses `endpointRoute` (not `docsRoute`)
- `endpointRoute` is the API path template that groups requests

## Related Files

- `../posthog/` - PostHog API client (real-time fallback)
- `../posthog/cache.ts` - Cache retrieval logic
- `../supabase/types.ts` - Database schema types
- `../../actions/getWebAnalytics.ts` - Server actions that use cache
- `../../api/cron/analytics/route.ts` - Cron endpoint

## Important Notes

- ✅ **Always implement in Redshift first** (cron job depends on it)
- ✅ **Use common WHERE clauses** for sent/received event queries
- ✅ **Test with real data** using the test scripts
- ✅ **Update Supabase types** when adding new fields
- ⚠️ **Redshift has 3-4 hour delay** - use PostHog for real-time only
- ⚠️ **Not all requests have responses** - this is expected
