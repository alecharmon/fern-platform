# Algolia Analytics Service

A service for fetching and analyzing search analytics data from Algolia, following the same architecture pattern as the PostHog service.

## Setup

### Environment Variables

Add these to your `.env.local`:

```bash
ALGOLIA_APP_ID=your_app_id
ALGOLIA_SEARCH_API_KEY=your_search_api_key
ALGOLIA_INDEX_NAME=fern_docs_search  # optional, defaults to fern_docs_search
```

## Architecture

```
algolia-analytics/
├── types.ts        # TypeScript interfaces and types
├── client.ts       # HTTP client for Algolia Analytics API
├── service.ts      # Business logic layer
├── index.ts        # Public API
└── algolia_sdk_test.ts  # CLI test tool
```

## Usage

### Basic Usage

```typescript
import { getAlgoliaAnalyticsService } from "./services/algolia-analytics";

// Create service instance
const algoliaService = getAlgoliaAnalyticsService({
    userId: "user-123",
    indexName: "fern_docs_search"
});

// Get top searches for last 7 days
const topSearches = await algoliaService.getTopSearches({
    dateRange: { type: "last_n_days", days: 7 },
    limit: 50
});

// Get searches with no results
const noResults = await algoliaService.getSearchesWithNoResults({
    dateRange: { type: "last_n_days", days: 7 },
    limit: 50
});

// Get overall search metrics
const metrics = await algoliaService.getSearchMetrics({
    dateRange: { type: "last_n_days", days: 7 }
});
```

### Filtering by Tag (e.g., by Endpoint)

```typescript
// Get top searches for specific endpoint
const endpointSearches = await algoliaService.getTopSearchesByTag({
    tag: "endpoint:openrouter.ai",
    dateRange: { type: "last_n_days", days: 7 },
    limit: 50
});

// Get no-result searches by endpoint
const noResultsByEndpoint = await algoliaService.getSearchesWithNoResultsByTag({
    tag: "endpoint:openrouter.ai",
    dateRange: { type: "last_n_days", days: 7 }
});
```

### Time Series Data

```typescript
// Get search count over time
const timeSeries = await algoliaService.getSearchCountTimeSeries({
    dateRange: { type: "last_n_months", months: 1 },
    groupBy: "day"  // or "week", "month"
});
```

## Available Methods

### `getTopSearches(options)`
Get the most popular search queries.

**Options:**
- `dateRange?: DateRangeOptions` - Time period to analyze
- `limit?: number` - Max results (default: 50)
- `tags?: string` - Filter by analytics tag

**Returns:** `TopSearchesResponse`
- `searches: TopSearch[]` - Array of search terms with counts and percentages
- `totalSearches: number` - Total search volume

### `getSearchesWithNoResults(options)`
Get searches that returned no results.

**Options:** Same as `getTopSearches`

**Returns:** `SearchesWithNoResultsResponse`
- `searches: SearchWithNoResults[]` - Array of no-result searches
- `totalSearchesWithNoResults: number` - Total no-result count

### `getSearchMetrics(options)`
Get aggregate search metrics.

**Options:**
- `dateRange?: DateRangeOptions`
- `tags?: string`

**Returns:** `SearchMetrics`
- `searchCount: number` - Total searches
- `noResultsRate: number` - Percentage with no results (0-1)
- `clickThroughRate?: number` - CTR (0-1)
- `conversionRate?: number` - Conversion rate (0-1)

### `getTopSearchesByTag(options)`
Get top searches filtered by a specific tag.

**Options:**
- `tag: string` - Tag to filter by (required)
- `dateRange?: DateRangeOptions`
- `limit?: number`

**Returns:** `TopSearchesResponse`

### `getSearchesWithNoResultsByTag(options)`
Get no-result searches filtered by tag.

**Options:** Same as `getTopSearchesByTag`

**Returns:** `SearchesWithNoResultsResponse`

### `getSearchCountTimeSeries(options)`
Get search volume over time.

**Options:**
- `dateRange?: DateRangeOptions`
- `groupBy?: "day" | "week" | "month"` - Aggregation period
- `tags?: string`

**Returns:** `TimeSeriesData[]`
- Array of `{ date: string, value: number }`

## Date Range Options

```typescript
// Last N days
{ type: "last_n_days", days: 7 }

// Last N weeks
{ type: "last_n_weeks", weeks: 2 }

// Last N months
{ type: "last_n_months", months: 3 }

// Custom range
{ type: "custom_range", startDate: "2025-01-01", endDate: "2025-01-31" }
```

## CLI Test Tool

### Interactive Mode

```bash
bun run src/app/services/algolia-analytics/algolia_sdk_test.ts --interactive
```

Interactive mode will prompt you for:
1. Index name
2. Time range
3. Optional tag filter
4. What data to display (menu-driven)

### Command-Line Mode

**Get search metrics:**
```bash
bun run src/app/services/algolia-analytics/algolia_sdk_test.ts \
  --index fern_docs_search \
  --metrics \
  --days 30
```

**Get top searches:**
```bash
bun run src/app/services/algolia-analytics/algolia_sdk_test.ts \
  --index fern_docs_search \
  --top-searches \
  --limit 100
```

**Get searches with no results:**
```bash
bun run src/app/services/algolia-analytics/algolia_sdk_test.ts \
  --index fern_docs_search \
  --no-results
```

**Get multiple analytics types:**
```bash
bun run src/app/services/algolia-analytics/algolia_sdk_test.ts \
  --index fern_docs_search \
  --metrics \
  --top-searches \
  --no-results
```

**Filter by endpoint tag:**
```bash
bun run src/app/services/algolia-analytics/algolia_sdk_test.ts \
  --index fern_docs_search \
  --by-tag \
  --tag "endpoint:openrouter.ai"
```

**Get time series:**
```bash
bun run src/app/services/algolia-analytics/algolia_sdk_test.ts \
  --index fern_docs_search \
  --time-series \
  --weeks 2
```

### CLI Options

**Required:**
- `--index <name>` - Algolia index name
- OR `--interactive` - Run in interactive mode

**Data options (at least one required):**
- `--metrics` - Show search metrics
- `--top-searches` - Show top searches
- `--no-results` - Show searches with no results
- `--time-series` - Show search volume over time
- `--by-tag` - Show searches by tag (requires `--tag`)

**Time options:**
- `--days <n>` - Last N days (default: 7)
- `--weeks <n>` - Last N weeks
- `--months <n>` - Last N months

**Filter options:**
- `--tag <value>` - Filter by analytics tag
- `--limit <n>` - Limit results (default: 50)

**Other:**
- `--help` / `-h` - Show help
- `--interactive` / `-i` - Interactive mode

## Example Output

### Top Searches
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 Top Searches
   Total searches: 347,340
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RANK    SEARCH QUERY                                     COUNT          %
   ────────────────────────────────────────────────────────────────────────
     #1    AI                                                25        7.20%
     #2    SDK                                               25        7.20%
     #3    Home                                              30        8.64%
```

### Search Metrics
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Search Metrics Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔎 Total Searches:      347,340
❌ No Results Rate:     0.67%
👆 Click-Through Rate:  1.73%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Algolia Analytics API Reference

This service uses Algolia's Analytics API v2:
- [Analytics API Documentation](https://www.algolia.com/doc/rest-api/analytics/)
- Base URL: `https://analytics.algolia.com/2/`

### API Endpoints Used

- `GET /searches/{index}` - Top searches
- `GET /searches/{index}/noResults` - Searches with no results
- `GET /searches/{index}/count` - Search count
- `GET /searches/{index}/noResultRate` - No results rate
- `GET /searches/{index}/clickThroughRate` - Click-through rate

### API Parameters

All endpoints support:
- `startDate` - ISO date string (YYYY-MM-DD)
- `endDate` - ISO date string (YYYY-MM-DD)
- `tags` - Filter by analytics tags
- `limit` - Max results (searches endpoints only)

## Notes

- Algolia stores analytics data for 90 days by default
- Tags must be set during search time using `analytics` parameter
- The service uses search API key, not admin key
- Rate limits apply per Algolia plan
