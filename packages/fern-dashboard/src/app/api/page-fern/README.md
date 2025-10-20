# Page Fern API - Create Incident

This endpoint allows authenticated users to create incidents in incident.io.

## Endpoint

```
POST /api/page-fern
```

## Authentication

Requires valid session authentication. The endpoint uses `maybeGetCurrentSession` to verify the user is authenticated.

## Environment Variables

Add the following environment variable to your `.env.local` file:

```env
INCIDENT_IO_API_KEY=your_incident_io_api_key_here
```

To obtain an API key:
1. Go to your incident.io dashboard
2. Navigate to API keys section
3. Create a new API key with appropriate permissions (needs access to create incidents)

## Request Body

```typescript
{
  name: string;                    // Required: Name of the incident
  idempotencyKey: string;          // Required: Unique key to prevent duplicate incidents
  severityId?: string;             // Optional: ID of the severity level
  visibility?: "public" | "private"; // Optional: Defaults to "public"
  summary?: string;                // Optional: Description of the incident
  customFieldEntries?: Array<{     // Optional: Custom field values
    customFieldId: string;
    values: Array<{
      id?: string;
      value?: string;
    }>;
  }>;
  incidentTypeId?: string;         // Optional: ID of the incident type
  incidentRoleAssignments?: Array<{ // Optional: Role assignments
    roleId: string;
    assignee: {
      id?: string;
      email?: string;
    };
  }>;
}
```

## Response

### Success Response (200)

```typescript
{
  success: true;
  incident: {
    id: string;
    name: string;
    reference: string;           // e.g., "INC-123"
    status: string;
    severity: {
      id: string;
      name: string;
    };
    visibility: string;
    createdAt: string;           // ISO 8601 timestamp
    permalinkUrl: string;        // Direct link to incident
  };
}
```

### Error Response (400/500)

```typescript
{
  success: false;
  error: string;
}
```

## Example Usage

```typescript
const response = await fetch('/api/page-fern', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Production API Outage',
    idempotencyKey: crypto.randomUUID(),
    severityId: '01FCNDV6P870EA6S7TK1DSYDG0',
    visibility: 'public',
    summary: 'The API is returning 503 errors for all requests',
  }),
});

const result = await response.json();
if (result.success) {
  console.log('Incident created:', result.incident.permalinkUrl);
} else {
  console.error('Failed to create incident:', result.error);
}
```

## Error Handling

The endpoint handles the following error scenarios:

- **Missing API Key**: Returns 500 if `INCIDENT_IO_API_KEY` is not configured
- **Validation Errors**: Returns 400 if required fields (name, idempotencyKey) are missing
- **incident.io API Errors**: Returns 500 with the error message from incident.io

## Rate Limits

The incident.io API has a default rate limit of 1200 requests/minute per API key. The endpoint does not implement additional rate limiting, so clients should implement their own rate limiting if needed.

## Getting Severity and Type IDs

To use severity levels, incident types, or custom fields, you need to first fetch the available options from incident.io:

- Severities: `GET https://api.incident.io/v2/severities`
- Incident Types: `GET https://api.incident.io/v2/incident_types`
- Custom Fields: `GET https://api.incident.io/v2/custom_fields`

See the [incident.io API documentation](https://api-docs.incident.io/) for more details.
