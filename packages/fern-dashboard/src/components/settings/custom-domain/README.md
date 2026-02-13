# Custom Domain Setup

Checklist-based flow for connecting a custom domain to a Fern docs site.

## Data Model

The `CustomDomainVerification` table tracks each domain setup with two boolean progress columns:

| Column              | Type    | Description                                      |
|---------------------|---------|--------------------------------------------------|
| `ownershipVerified` | boolean | TXT record verified, domain added to Vercel      |
| `dnsConfigured`     | boolean | DNS records or reverse proxy confirmed            |
| `prUrl`             | text?   | URL of the auto-generated docs.yml PR, if created |

A third checklist item, "Update docs.yml configuration", has no DB column. It is derived at runtime by comparing `docsUrl === domainInfo.domain` (i.e. the site is already publishing to the custom domain).

### Completion

Setup is complete when `ownershipVerified && dnsConfigured` are both `true` and the config has been published (runtime check).

## Checklist Items

1. **Verify domain ownership** -- User adds a TXT record, then clicks "Verify Ownership". On success, `ownershipVerified` is set to `true`. No prerequisites.
2. **Update docs.yml configuration** -- User either creates a PR via the dashboard or manually updates their config. Completion is detected at runtime (`docsUrl === domain`). No prerequisites; can be done in parallel with step 1.
3. **Configure DNS / reverse proxy** -- Locked until step 1 completes (Vercel DNS records are only available after TXT verification). For regular domains, user adds CNAME/A records. For subpath domains, user configures a reverse proxy. On success, `dnsConfigured` is set to `true`.

## Architecture

```
database.types.ts          -- Generated Supabase types (ownershipVerified, dnsConfigured, prUrl)
supabase/types.ts          -- CustomDomainVerificationRow
domain/types.ts            -- CustomDomainInfo (formatted for UI)
domain/repository.ts       -- DB operations: createVerification, updateChecklistStep, updatePrUrl, formatVerificationInfo

actions/customDomain/
  updateChecklistStep.ts   -- Server action: sets { ownershipVerified?, dnsConfigured? }
  index.ts                 -- Re-exports all actions

custom-domain/
  domainSetupStateMachine.ts  -- Pure reducer + getInitialChecklistState({ ownershipVerified, configPublished, dnsConfigured })
  useDomainSetupState.ts      -- React hook wrapping useReducer
  DomainSetupChecklist.tsx    -- Renders the three checklist items
  VerifyOwnershipContent.tsx  -- Calls updateDomainChecklistStep({ ownershipVerified: true })
  ConfigureDnsContent.tsx     -- Calls updateDomainChecklistStep({ dnsConfigured: true })
  ConfigureProxyContent.tsx   -- Calls updateDomainChecklistStep({ dnsConfigured: true })
  UpdateConfigContent.tsx     -- PR creation / manual config guidance
  ChecklistItem.tsx           -- Visual component for a single checklist row
  SetupCompleteContent.tsx    -- Shown when all three items are complete
```

## State Machine

`getInitialChecklistState` maps DB booleans to UI state:

| ownershipVerified | configPublished | dnsConfigured | Ownership   | Config      | DNS/Proxy   |
|-------------------|-----------------|---------------|-------------|-------------|-------------|
| false             | *               | false         | not-started | (derived)   | locked      |
| true              | *               | false         | complete    | (derived)   | not-started |
| true              | true            | true          | complete    | complete    | complete    |

The reducer handles transient UI states (in-progress, failed) that don't persist to the DB.

## Consumer Components

- **`CustomDomainCard.tsx`** (settings page) -- Derives `isComplete` / `needsDns` / `needsProxy` from the boolean fields and `hasSubpath(domain)`.
- **`CustomDomainButton.tsx`** (docs page) -- Same derivation, compact layout.
- **`AddCustomDomainModal.tsx`** -- Hosts the enter-domain form and the `DomainSetupChecklist`. Refreshes the page on close if `ownershipVerified` or `dnsConfigured` changed.
