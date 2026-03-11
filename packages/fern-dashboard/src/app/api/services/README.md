# /api/services

Service-to-service API endpoints. These are called by backend services (FAI, ask-fern, etc.), not by the dashboard UI.

Auth: JWT via `@fern-platform/service-jwt-auth` — no Auth0 session required.

## Endpoints

- **`/api/services/activity-log/`** — Activity logging and AI credit usage tracking
