# @fern-platform/billing Overview

This package centralizes Fern’s billing logic: Stripe client setup, database accessors, webhook processing, and helpers for syncing subscriptions and customers.

## Environment
- `STRIPE_SECRET_KEY` — required for any Stripe API calls.
- `STRIPE_WEBHOOK_SECRET` — webhook signature verification (config in dashboard); optional override can be passed to `constructWebhookEvent`.

## Data Model (ER)
```mermaid
erDiagram
  ORG {
    uuid id PK
  }

  ORG_BILLING_ACCOUNT {
    uuid org_id FK
    string stripe_customer_id "unique"
  }

  ORG_SUBSCRIPTION {
    uuid id PK
    uuid org_id FK
    string stripe_subscription_id "unique"
    string status
    timestamptz current_period_start
    timestamptz current_period_end
  }

  ORG_SUBSCRIPTION_ITEM {
    uuid id PK
    uuid org_subscription_id FK
    uuid org_billing_product FK
    string stripe_subscription_item_id "unique"
    int quantity
  }

  BILLING_PRODUCT {
    uuid id PK
    string sku "unique"
    string kind
    string tier
    bool active
  }

  STRIPE_EVENT_INBOX {
    string stripe_event_id PK
    string type
    timestamptz created_at
    jsonb payload
    timestamptz processed_at
    string processing_error
  }

  ORG ||--o{ ORG_BILLING_ACCOUNT : has
  ORG ||--o{ ORG_SUBSCRIPTION : has
  ORG_SUBSCRIPTION ||--o{ ORG_SUBSCRIPTION_ITEM : contains
  BILLING_PRODUCT ||--o{ ORG_SUBSCRIPTION_ITEM : referenced_by
```

## Webhook Flow
```mermaid
sequenceDiagram
  participant Stripe
  participant Dashboard as Dashboard /api/webhooks/stripe
  participant Billing as billing.processWebhookEvent
  participant Inbox as stripe_event_inbox
  participant Handler as handleWebhookEvent
  participant DB as Supabase

  Stripe->>Dashboard: POST webhook (signed)
  Dashboard->>Billing: constructWebhookEvent + processWebhookEvent(event)
  Billing->>Inbox: tryInsertEvent (idempotency check)
  alt duplicate event
    Billing-->>Dashboard: skipped=true (200)
  else new event
    Billing->>Handler: handleWebhookEvent(event)
    Handler->>DB: sync customer/subscription + items
    Handler-->>Billing: ok | BillingError
    Billing->>Inbox: markEventProcessed OR markEventFailed
    Billing-->>Dashboard: processed=true/false (always 200)
  end
  Dashboard-->>Stripe: 200 JSON (prevents retries even on handler error)
```

### Customer Updated (org transfer) Flow
```mermaid
sequenceDiagram
  participant Stripe
  participant Dashboard as Dashboard /api/webhooks/stripe
  participant Billing as billing.processWebhookEvent
  participant Handler as handleWebhookEvent(customer.updated)
  participant Sync as syncCustomerUpdateFromStripe
  participant DB as Supabase
  participant StripeAPI as Stripe API

  Stripe->>Dashboard: customer.updated (signed)
  Dashboard->>Billing: processWebhookEvent(event)
  Billing->>Handler: handleWebhookEvent(event)
  Handler->>Sync: syncCustomerUpdateFromStripe(customer)
  Sync->>DB: getOrgBillingAccountByCustomerId
  alt org_id changed
    Sync->>DB: delete old org_billing_account for customer
    Sync->>DB: upsert new org_billing_account (new org_id)
    Sync->>StripeAPI: subscriptions.list({ customer })
    loop each subscription
      Sync->>Billing: syncSubscriptionFromStripe(subscription)
      Billing->>DB: upsert org_subscription + items
    end
  else unchanged org_id
    Sync-->>Handler: changed=false
  end
  Handler-->>Billing: handled + details (changed?)
  Billing-->>Dashboard: processed=true/false
  Dashboard-->>Stripe: 200 JSON
```

## Key APIs
- `getStripeClient()` / `constructWebhookEvent(payload, sig, secret?)`
- Idempotency: `withIdempotency(event, handler)`
- Sync: `syncSubscriptionFromStripe`, `syncCustomerFromStripe`, `syncCustomerUpdateFromStripe`
- Routing: `handleWebhookEvent`
- Entry point: `processWebhookEvent`
- DB helpers live under `src/db/*.ts`.

## Tests
- `pnpm --filter=@fern-platform/billing test` (Vitest)
- Webhook route tests in dashboard: `pnpm --filter=@fern-dashboard/ui test -- --testNamePattern=webhooks/stripe`

## Build
- `pnpm --filter=@fern-platform/billing compile`
