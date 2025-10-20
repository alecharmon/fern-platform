# Incidents Feature

This feature allows users to create incidents in incident.io directly from the Fern dashboard.

## Feature Flag

The incidents page is controlled by the feature flag:
```typescript
PosthogFeatureFlag.ENABLE_INCIDENTS_PAGE = "dashboard-enable-incidents-page"
```

To enable the feature for a user or organization, set this flag to `true` in PostHog.

## Components

### CreateIncidentPage
**Location:** `src/components/incidents/CreateIncidentPage.tsx`

A client-side form component that allows users to create incidents with the following fields:
- **Incident Name** (required): The name/title of the incident
- **Summary** (optional): A detailed description of the incident
- **Severity ID** (optional): The ID of the severity level from incident.io
- **Visibility**: Either "public" or "private" (defaults to "public")

The component:
- Generates unique idempotency keys to prevent duplicate incidents
- Displays success messages with incident reference and permalink
- Shows error messages when creation fails
- Validates required fields before submission
- Provides a clear button to reset the form

## Page Route

**Location:** `src/app/[orgName]/(homepage)/incidents/page.tsx`

The page is accessible at `/{orgName}/incidents` and is protected by:
1. Authentication check (redirects to `/` if not logged in)
2. Feature flag check (redirects to `/members` if feature is disabled)

## Navigation

The incidents page appears in the sidebar navigation between "SDKs" and "Settings" when the feature flag is enabled.

**Icon:** Uses the `AlertIconAnimated` component with a triangle warning icon
**Icon Location:** `src/components/navbar/AlertIconAnimated.tsx`

## API Integration

The form calls the `/api/page-fern` endpoint (POST) with the following payload:
```typescript
{
  name: string;
  idempotencyKey: string;
  severityId?: string;
  visibility: "public" | "private";
  summary?: string;
}
```

See `src/app/api/page-fern/README.md` for full API documentation.

## Environment Configuration

Requires the following environment variable:
```env
INCIDENT_IO_API_KEY=your_incident_io_api_key_here
```

## Testing the Feature

1. Enable the feature flag in PostHog:
   - Set `dashboard-enable-incidents-page` to `true` for your user/organization

2. Navigate to the dashboard at `/{orgName}/incidents`

3. The "Incidents" link should appear in the sidebar navigation

4. Fill out the form and create a test incident

5. Verify the incident was created in incident.io

## Future Enhancements

Possible improvements to this feature:
- Fetch and display available severity levels from incident.io API
- Support for custom fields
- Support for incident role assignments
- List view of existing incidents
- Incident status updates
- Integration with incident.io webhooks for real-time updates
