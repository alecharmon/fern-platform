# Unified Permissions Endpoint Design

## Overview

Rewrite the permissions update flow in the dashboard to use a single declarative endpoint instead of multiple orchestrated calls from the client.

## Current State

Three separate endpoints for permission management:
- `setUserResourceRole` (server action) - sets individual fine-grained resource roles
- `removeUserResourceRole` (server action) - removes individual fine-grained resource roles
- `updateUserRoles` (API route) - updates org-level Auth0 roles

Complex client-side logic in `EditPermissionsDialog` orchestrates multiple calls with conditional branching.

## New Design

### Endpoint Contract

**Endpoint:** `POST /api/update-user-permissions`

**Request:**
```typescript
interface UpdateUserPermissionsRequest {
  orgName: string;
  userId: string;
  permissions:
    | { type: "org"; role: "admin" | "editor" | "viewer"; cliEnabled: boolean }
    | { type: "fine-grained"; resourceRoles: Record<string, {
        role: "admin" | "editor" | "viewer";
        cliEnabled: boolean
      }>
    };
}
```

**Response:**
```typescript
{ ok: true }
| { ok: false; code: "validation_error" | "invalid_permissions" | "cannot_modify_self" | "error"; message: string }
```

### Server-Side Validation Rules

1. For `type: "org"` - `role` is required, `cliEnabled` only valid when `role === "editor"`
2. For `type: "fine-grained"` - `resourceRoles` must have at least one entry with a non-"none" role
3. User cannot modify their own permissions

### Server-Side Logic Flow

```
1. Parse & validate request
2. Check user is not modifying self
3. Fetch current state (for diff computation):
   - Auth0 roles for target user
   - Supabase resource roles for target user
4. Compute diff based on desired state
5. Execute changes (in order):
   a. If switching TO org-level: remove all resource roles first
   b. If switching TO fine-grained: remove org-level roles first
   c. Apply the new roles
6. Invalidate user session (Redis)
7. Return success
```

Authorization is handled by middleware via `ROUTE_PERMISSION_CONFIGS`.

### Diff Logic

| Current State | Desired State | Actions |
|---------------|---------------|---------|
| Org-level | Org-level | Update Auth0 roles only (add/remove delta) |
| Org-level | Fine-grained | Remove Auth0 roles → Add resource roles |
| Fine-grained | Org-level | Remove all resource roles → Add Auth0 roles |
| Fine-grained | Fine-grained | Diff resource roles (remove changed, add new) |

### Client Changes

`EditPermissionsDialog` simplified to send declarative state:

```typescript
const updatePermissions = useMutation({
  mutationFn: async () => {
    const permissions = accessType === "org"
      ? { type: "org", role: selectedRole, cliEnabled }
      : { type: "fine-grained", resourceRoles: buildResourceRolesPayload() };

    return DashboardApiClient.updateUserPermissions({
      orgName,
      userId,
      permissions
    });
  }
});
```

## Files

### Create
- `src/app/api/update-user-permissions/route.ts` - New unified endpoint
- `src/app/api/update-user-permissions/validation.ts` - Request validation logic
- `src/app/api/update-user-permissions/__tests__/route.test.ts` - Endpoint tests
- `src/app/api/update-user-permissions/__tests__/validation.test.ts` - Validation tests
- `src/components/members/__tests__/EditPermissionsDialog.test.tsx` - Modal tests

### Modify
- `src/components/members/EditPermissionsDialog.tsx` - Simplify to use new endpoint
- `src/app/services/dashboard-api/client.ts` - Add `updateUserPermissions` method
- `src/route-permissions.ts` - Add route config for new endpoint

### Delete
- `src/app/actions/setUserResourceRole.ts` - Replaced by unified endpoint
- `src/app/actions/removeUserResourceRole.ts` - Replaced by unified endpoint
- `src/app/api/update-user-roles/route.ts` - Replaced by unified endpoint

## Testing Strategy

### Endpoint Tests
- Returns error when user tries to modify self
- Validates org-level: rejects cliEnabled for non-editor
- Validates fine-grained: rejects empty resourceRoles
- Validates fine-grained: rejects when all roles are 'none'
- Org → org: updates Auth0 roles correctly
- Org → fine-grained: removes Auth0 roles, adds resource roles
- Fine-grained → org: removes resource roles, adds Auth0 roles
- Fine-grained → fine-grained: diffs resource roles correctly
- Invalidates user session on success

### Modal Tests
- Renders with current user roles pre-selected
- Disables save when no changes made
- Sends correct payload for org-level permissions
- Sends correct payload for fine-grained permissions
- Shows loading state while saving
- Shows error toast on failure
- Closes dialog on success

### Validation Tests
- Org-level: valid with admin/editor/viewer
- Org-level: cliEnabled only valid for editor
- Fine-grained: valid with at least one resource role
- Fine-grained: invalid with empty resourceRoles
- Fine-grained: invalid when all roles are 'none'

## Implementation Order

1. Create validation logic + tests (pure functions)
2. Create endpoint + tests (with mocked dependencies)
3. Add route permission config
4. Add client method to DashboardApiClient
5. Update EditPermissionsDialog + tests
6. Verify everything works end-to-end
7. Delete old endpoints/actions
8. Final commit and PR
