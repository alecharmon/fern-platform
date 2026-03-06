# Upsell Components

Entitlement-gated upgrade prompts for the Fern Dashboard. When a user hits a plan limit (seats, AI credits, custom domains, etc.), the upsell system intercepts the action and shows a contextual modal with upgrade options.

## Architecture

```
UpsellProvider (context)
├── UpsellGate          ← wraps gated UI; intercepts clicks when not entitled
├── LazyUpsellModal     ← client-only dynamic import of UpsellModal
│   └── UpsellModal     ← renders the modal dialog
│       ├── configs.ts  ← per-feature modal copy, icons, actions, tier overrides
│       ├── types.ts    ← UpsellFeature, UpsellAction, UpsellConfig, etc.
│       ├── actions.ts  ← executeUpsellAction (redirect / checkout / contact-sales / pylon)
│       └── content/    ← custom per-tier modal body components
│           ├── SeatCounterContent.tsx  ← inline seat purchase with Stripe price preview
│           └── formatCentsAsDollars.ts
└── useCurrentTier      ← hook to resolve the org's billing tier
```

### Key Dependencies

| Package | Role |
|---|---|
| `@fern-platform/billing` | `ProductTier`, `MAX_PRO_TOTAL_SEATS`, plan SKUs |
| `@fern-platform/entitlements` | `EntitlementKey` used by `UPSELL_FEATURE_ENTITLEMENT_MAP` |
| `@/state/useEntitlement` | Client hook for entitlement checks (used by `UpsellGate` and `SeatCounterContent`) |
| `posthog-js` | Analytics events (`BILLING_LIMIT_HIT`, `UPGRADE_CTA_CLICKED`) |

## Components

### `UpsellProvider`

React context that tracks which upsell feature is currently active. Place it near the root of the dashboard layout.

```tsx
<UpsellProvider>
  <LazyUpsellModal />
  {children}
</UpsellProvider>
```

**API:**
- `useUpsell()` returns `{ activeFeature, isOpen, openUpsell, closeUpsell }`

### `UpsellGate`

Declarative wrapper that gates children behind an entitlement check.

```tsx
<UpsellGate feature="seats">
  <InviteMemberButton />
</UpsellGate>
```

**Behavior by state:**
| State | Rendering |
|---|---|
| Loading | `fallback` prop if provided, otherwise pulsing children |
| Entitled | Children rendered directly (no wrapper DOM) |
| Not entitled | Children wrapped with an invisible click-intercepting overlay that opens the upsell modal |

### `UpsellModal`

The modal dialog itself. Reads the active feature from `UpsellProvider`, resolves the config from `UPSELL_CONFIGS`, and renders:
1. A decorative header (gradient + icon, or a custom `headerContent` component)
2. Title, description, feature list (with optional per-tier overrides)
3. CTA button that executes the configured `UpsellAction`
4. Optional custom content slot (e.g. `SeatCounterContent` for paid-tier seat purchases)

### `LazyUpsellModal`

Thin `next/dynamic` wrapper that loads `UpsellModal` client-only (`ssr: false`) to avoid hydration hook-count mismatches.

## Configuration

### Adding a new upsell feature

1. Add the feature key to `UpsellFeature` in `types.ts`
2. Map it to an `EntitlementKey` in `UPSELL_FEATURE_ENTITLEMENT_MAP`
3. Add a config entry in `configs.ts` (`UPSELL_CONFIGS`)
4. Optionally add custom content in `content/index.ts` (`UPSELL_CONTENT`)

### `UpsellConfig` shape

```ts
interface UpsellConfig {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  headerContent?: ComponentType;           // replaces default gradient header
  featureIntro?: string;                   // "Along with ..., you'll get..."
  features?: UpsellFeatureItem[];          // icon + text rows
  learnMoreUrl?: string;                   // shows "Learn more" button
  actions: Partial<Record<ProductTier, UpsellAction>>;
  content?: Partial<Record<ProductTier, ComponentType<UpsellContentProps>>>;
  tierOverrides?: Partial<Record<ProductTier, UpsellTierOverride>>;
}
```

### Action types

| Type | Behavior |
|---|---|
| `redirect` | `router.push` to a relative URL (e.g. `/billing?reason=seat_limit`) |
| `checkout` | Redirects to billing page (inline checkout handled by custom content) |
| `contact-sales` | Opens URL in new tab |
| `pylon` | Opens the Pylon support chat widget with an optional pre-filled message |

## Storybook

All upsell components have Storybook stories under the `Upsells/` category. Stories use presentational wrappers that mirror the real component visuals without requiring providers or server actions.

### Running Storybook

```bash
pnpm --filter=@fern-dashboard/ui storybook
```

### Story files

| File | Storybook path | What it covers |
|---|---|---|
| `UpsellGate.stories.tsx` | `Upsells/UpsellGate` | Three gate states (entitled, not-entitled, loading) + interactive toggle |
| `UpsellModal.stories.tsx` | `Upsells/UpsellModal` | All five features across free/paid/enterprise tiers |
| `UpsellSeatPurchase.stories.tsx` | `Upsells/UpsellModal/Seat Purchase` | Full seat purchase flow: counter, price preview, Stripe errors |
| `content/SeatCounterContent.stories.tsx` | `Upsells/SeatCounterContent` | Isolated seat counter content: adding/removing seats, price states, error callouts |

Stories are tagged with `autodocs` for automatic documentation generation.

### Story design pattern

Stories render **presentational wrappers** that accept explicit props (state, callbacks) instead of depending on context providers or server actions. This keeps stories fast, deterministic, and testable. For Pylon actions, a mock decorator installs a spy on `window.Pylon` so calls appear in the Storybook actions panel.

## Tests

```bash
pnpm --filter=@fern-dashboard/ui test -- --testNamePattern=upsell
```

Test files live in `__test__/` alongside the source:
- `UpsellModal.test.tsx` — modal rendering and interaction
- `UpsellGate.test.tsx` — gate behavior across entitlement states
- `actions.test.ts` — action execution logic
- `configs.test.ts` — config validation
- `types.test.ts` — type guard and mapping tests
- `content/formatCentsAsDollars.test.ts` — currency formatting
