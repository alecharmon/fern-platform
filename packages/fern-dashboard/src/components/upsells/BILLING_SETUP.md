# Billing Setup Guide for Signed Customers

This guide covers what needs to be configured in Stripe and Supabase to get billing working for a new or existing customer.

## Overview

Billing works through three connected layers:

1. **Stripe** — source of truth for subscriptions, prices, and payment
2. **Supabase** — mirrors Stripe state via webhooks; used by the app at runtime
3. **Application code** — static SKU + grant mappings that control feature access

When a customer subscribes, Stripe fires webhooks that sync data into Supabase. The entitlements system reads Supabase to decide what the org can do.

---

## 1. Stripe Product Setup

### Required Stripe Products

Each Stripe Product must have a `sku` key in its **metadata**. This is how the webhook sync identifies what was purchased. Without this metadata, the subscription item is silently skipped.

| Product | SKU (metadata key: `sku`) | Kind | Tier |
|---------|---------------------------|------|------|
| Team plan | `2025-02-05:docs-team` | `plan` | `paid` |
| Legacy enterprise | `legacy:custom-enterprise` | `plan` | `enterprise` |
| Additional seats (addon) | `2025-02-10:additional-seats` | `addon` | `paid` |

> **Critical**: The `sku` metadata on the Stripe Product is the single link between Stripe and the entitlements system. If it's missing or wrong, the customer gets no grants from that product.

### Required Stripe Prices

The app resolves prices by ID at checkout time. These are hardcoded per environment:

**Live mode** (`sk_live_*`):

| Price | Stripe Price ID |
|-------|----------------|
| Team monthly | `price_1SxVS3FYKJHzTJV9tzJ6f5c0` |
| Team yearly | `price_1SxVS3FYKJHzTJV9j6eSH7GZ` |
| Super user | `price_1SxYXdFYKJHzTJV9khP7EqTH` |
| Addon seat (monthly) | `price_1T1V0KFYKJHzTJV9eWh7uGdj` |
| Addon seat (yearly) | `price_1T5AmEFYKJHzTJV9gVrwP4By` |

**Test mode** (`sk_test_*`):

| Price | Stripe Price ID |
|-------|----------------|
| Team monthly | `price_1T58u1FYKJHzTJV98TXaSZAj` |
| Team yearly | `price_1T58u1FYKJHzTJV9ocXjP8ex` |
| Super user | `price_1T58u1FYKJHzTJV9ocXjP8ex` |
| Addon seat (monthly) | `price_1T58uVFYKJHzTJV9C2Wju9ia` |
| Addon seat (yearly) | `price_1T5AkzFYKJHzTJV9CePIGzCD` |

> The environment is auto-detected from the `STRIPE_SECRET_KEY` env var (test vs live prefix).

### Stripe Customer Metadata

When a customer is created (either via checkout or manually), the Customer object must have:

| Metadata key | Value | Required |
|-------------|-------|----------|
| `orgId` | The Fern organization ID (e.g., `org_abc123`) | Yes |

The webhook handler reads `customer.metadata.org_id` or `customer.metadata.orgId` to link the Stripe customer to a Fern org. If this is missing, the `customer.created` webhook will fail.

### Stripe Webhook Configuration

The following events must be forwarded to the dashboard webhook endpoint (`/api/webhooks/stripe`):

- `customer.created`
- `customer.updated`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`

---

## 2. Supabase Tables

The webhook sync populates these tables automatically. You should not need to write to them manually unless troubleshooting.

### `billing_product`

Stores the product catalog. Each row maps a Stripe Product to an internal SKU, kind, and tier.

| Column | Description |
|--------|-------------|
| `id` | Internal UUID |
| `sku` | Must match the Stripe Product metadata `sku` value |
| `kind` | `plan` or `addon` |
| `tier` | `free`, `paid`, or `enterprise` |
| `is_active` | Whether this product is currently available |

> **This table must be seeded before webhooks will work.** The webhook sync looks up the product by SKU. If the `billing_product` row doesn't exist for a given SKU, that subscription item is skipped.

### `org_billing_account`

Links a Fern org to a Stripe customer. Created on `customer.created` webhook or during checkout.

| Column | Description |
|--------|-------------|
| `org_id` | Fern organization ID (unique) |
| `stripe_customer_id` | Stripe Customer ID (`cus_*`) |

### `org_subscription`

One row per Stripe subscription.

| Column | Description |
|--------|-------------|
| `org_id` | Fern organization ID |
| `stripe_subscription_id` | Stripe Subscription ID (`sub_*`) |
| `status` | `active`, `trialing`, `past_due`, `canceled`, etc. |
| `current_period_start` | Billing period start |
| `current_period_end` | Billing period end |

### `org_subscription_item`

One row per line item in a subscription (e.g., the plan + addon seats).

| Column | Description |
|--------|-------------|
| `org_subscription_id` | FK to `org_subscription` |
| `org_billing_product` | FK to `billing_product` |
| `stripe_subscription_item_id` | Stripe Subscription Item ID (`si_*`) |
| `quantity` | Number of units (e.g., number of addon seats) |

### `org_active_products` (view)

A database view that joins subscriptions, items, and products. This is what `getBillingPlan()` queries at runtime. It filters to active statuses: `active`, `trialing`, `incomplete`, `past_due`.

---

## 3. What Each SKU Grants

These are defined in code (`packages/commons/entitlements/src/grants.ts`) and are **not configurable at runtime**.

### Free plan (no SKU / no subscription)

| Entitlement | Value |
|------------|-------|
| `seats` | 2 |
| `docs_sites` | 5 |
| `number_of_custom_domains` | 1 |
| `can_purchase_additional_seats` | No |
| `custom_domain_subpath` | No |

### Team plan (`2025-02-05:docs-team`)

| Entitlement | Value |
|------------|-------|
| `seats` | 5 |
| `docs_sites` | 5 |
| `number_of_custom_domains` | 1 |
| `can_purchase_additional_seats` | Yes |
| `custom_domain_subpath` | Yes |

### Legacy enterprise (`legacy:custom-enterprise`)

| Entitlement | Value |
|------------|-------|
| `seats` | Unlimited |
| `docs_sites` | Unlimited |
| `number_of_custom_domains` | Unlimited |
| `can_purchase_additional_seats` | No |
| `custom_domain_subpath` | Yes |

### Additional seats addon (`2025-02-10:additional-seats`)

Adds **+1 seat** per unit of quantity on the subscription item. Stacks with the base plan's seat grant.

---

## 4. Setting Up a New Customer

### Self-serve (customer upgrades themselves)

No manual setup needed. The flow is:

1. Customer clicks upgrade in the dashboard
2. Stripe Checkout creates the Customer (with `orgId` metadata) and Subscription
3. Webhooks fire → Supabase tables are populated
4. Entitlements resolve on next page load

### Manual / sales-assisted setup

For enterprise or custom deals where you create the subscription in Stripe directly:

1. **Create a Stripe Customer**
   - Set metadata: `orgId` = the customer's Fern org ID
   - Use the org admin's email

2. **Create a Stripe Subscription**
   - Attach to the customer created above
   - Add the appropriate product/price as a line item
   - Ensure the Stripe Product has `sku` in its metadata

3. **Verify `billing_product` rows exist**
   - Check that Supabase has a `billing_product` row with a matching `sku`
   - If using a new SKU, insert a row with the correct `kind` and `tier`

4. **Wait for webhooks** (or trigger manually)
   - The `customer.created` webhook creates the `org_billing_account` link
   - The `customer.subscription.created` webhook creates the subscription + items
   - If webhooks were missed, you can resend them from the Stripe dashboard

5. **Verify in Supabase**
   - `org_billing_account` has a row for the org
   - `org_subscription` shows status `active` or `trialing`
   - `org_subscription_item` has the correct products and quantities
   - `org_active_products` view returns the expected rows

---

## 5. Pricing Reference

| Plan | Monthly | Yearly | Trial |
|------|---------|--------|-------|
| Team | $200/mo | $150/mo (billed yearly) | 14 days (first subscription only) |
| Addon seat | $20/seat/mo | Matches plan interval | — |
| Enterprise | Custom | Custom | — |

- Max addon seats: **100**
- Max total seats on Team plan: **10** (base 5 + up to 5 addon)
- Free trial is only offered if the org has **never had a subscription before**
- Free trial is enabled in live mode, disabled in test mode

---

## 6. Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Customer shows as free tier despite active subscription | Stripe Product is missing `sku` metadata, or `billing_product` table doesn't have a matching row |
| "No billing account found" errors in webhook logs | Stripe Customer is missing `orgId` metadata |
| Entitlements not updating after purchase | Webhook failed or was not delivered — check Stripe webhook logs and resend |
| Customer can't purchase addon seats | They're on the free tier — `can_purchase_additional_seats` is only granted by the Team plan SKU |
| Subscription shows in Stripe but not in dashboard | `org_active_products` view filters to `active`, `trialing`, `incomplete`, `past_due` — check the subscription status |
