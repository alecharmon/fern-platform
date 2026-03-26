# Fern Dashboard UI Component Library

> These are the **canonical UI components** for the fern-platform dashboard.
> **NEVER** create new primitive components — always import from `@/components/ui/...`.
> Always check this file before creating or designing any new UI component.

## Rules

- Never use raw `<button>`, `<input>`, `<select>`, or `<textarea>` elements — use the components below
- Never create a new component if one already exists here
- If a component you need is missing, ask before building a new one
- All components live in `packages/fern-dashboard/src/components/`
- Stories live alongside each component as `ComponentName.stories.tsx`

---

## Components

### OrgAlert

- **Source:** `packages/fern-dashboard/src/components/org-alert/OrgAlert.tsx`
- **Stories:** `packages/fern-dashboard/src/components/org-alert/OrgAlert.stories.tsx`

```tsx
import { OrgAlert } from '@/components/org-alert/OrgAlert';
```

**Props:**

- `variant`: `"warning"` | `"danger"`
- `onAction`

**Variants:** TrialEnding, TrialEnded, PaymentFailed, AiServicesPaused

---

## UI

### Badge

- **Source:** `packages/fern-dashboard/src/components/ui/Badge.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/Badge.stories.tsx`

```tsx
import { Badge } from '@/components/ui/Badge';
```

**Props:**

- `variant`: `"info"` | `"success"` | `"warning"`

**Variants:** Info, Success, Warning

### Button

- **Source:** `packages/fern-dashboard/src/components/ui/button.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/button.stories.tsx`

```tsx
import { Button } from '@/components/ui/button';
```

**Props:**

- `variant`: `"default"` | `"destructive"` | `"destructiveOutline"` | `"outline"` | `"secondary"` | `"ghost"` | `"link"` | `"linkUnderlined"` | `"dark"`
- `size`: `"default"` | `"xs"` | `"sm"` | `"lg"` | `"icon"` | `"iconSm"`
- `loading`: boolean
- `disabled`: boolean

**Usage:**

```tsx
<Button>Create plant</Button>
```

**Variants:** Default, Outline, Secondary, Destructive, DestructiveOutline, Ghost, Link, LinkUnderlined, Small, ExtraSmall, Large, WithIcon, IconOnly, Loading, Disabled, Dark

### Card

- **Source:** `packages/fern-dashboard/src/components/ui/card.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/card.stories.tsx`

```tsx
import { Card } from '@/components/ui/card';
```

**Usage:**

```tsx
<Card />
```

**Variants:** Default, WithCustomStyle

### CopyableText

- **Source:** `packages/fern-dashboard/src/components/ui/CopyableText.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/CopyableText.stories.tsx`

```tsx
import { CopyableText } from '@/components/ui/CopyableText';
```

**Props:**

- `variant`: `"default"` | `"innerCopy"`

**Usage:**

```tsx
<CopyableText text="npm install @fern-api/plantstore-sdk" successMessage="Install command copied!" />
```

**Variants:** Default, InnerCopy, LongText

### DataTable

- **Source:** `packages/fern-dashboard/src/components/ui/data-table/data-table.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/data-table/data-table.stories.tsx`

```tsx
import { DataTable } from '@/components/ui/data-table/data-table';
```

A composable data table built on top of [TanStack Table](https://tanstack.com/table). Supports client-side and server-side pagination, column filtering, global search, sortable headers, and loading states (skeleton rows on initial load, spinner overlay on subsequent fetches). Composed via sub-components — `DataTable.Toolbar`, `DataTable.Content`, `DataTable.Header`, `DataTable.Body`, `DataTable.Pagination`, and `DataTable.SearchBar` — so the layout is fully flexible.

**Variants:** Default, WithSearch, SmallDataset, Empty, ServerSidePagination, ServerSideWithFetching, ServerSideInitialLoad, ClientSideWithFetching, WithRoundedBorder

### Dialog

- **Source:** `packages/fern-dashboard/src/components/ui/dialog.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/dialog.stories.tsx`

```tsx
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
```

**Variants:** Default, Persistent, OpenByDefault

### DropdownMenu

- **Source:** `packages/fern-dashboard/src/components/ui/dropdown-menu.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/dropdown-menu.stories.tsx`

```tsx
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
```

**Variants:** Default, WithCheckboxItems, WithRadioItems, WithSubmenu

### ExternalHoverLink

- **Source:** `packages/fern-dashboard/src/components/ui/ExternalHoverLink.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/ExternalHoverLink.stories.tsx`

```tsx
import { ExternalHoverLink } from '@/components/ui/ExternalHoverLink';
```

**Usage:**

```tsx
<ExternalHoverLink href="https://buildwithfern.com" />
```

**Variants:** Default, WithDisplayHref, LongUrl

### Input

- **Source:** `packages/fern-dashboard/src/components/ui/input.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/input.stories.tsx`

```tsx
import { Input } from '@/components/ui/input';
```

**Props:**

- `type`: `"text"` | `"password"` | `"email"` | `"number"` | `"search"` | `"url"`
- `disabled`: boolean

**Usage:**

```tsx
<Input placeholder="Enter plant name..." />
```

**Variants:** Default, WithValue, Password, Number, Disabled, Invalid

### Label

- **Source:** `packages/fern-dashboard/src/components/ui/label.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/label.stories.tsx`

```tsx
import { Label } from '@/components/ui/label';
```

**Usage:**

```tsx
<Label>Plant name</Label>
```

**Variants:** Default, WithInput

### Popover

- **Source:** `packages/fern-dashboard/src/components/ui/popover.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/popover.stories.tsx`

```tsx
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
```

**Variants:** Default, OpenByDefault

### RadioGroup

- **Source:** `packages/fern-dashboard/src/components/ui/radio-group.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/radio-group.stories.tsx`

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
```

**Variants:** Default, WithDescriptions, Disabled

### Select

- **Source:** `packages/fern-dashboard/src/components/ui/select.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/select.stories.tsx`

```tsx
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
```

**Variants:** Default, WithGroups, WithDescriptions, Small, WithDisabledItems

### Skeleton

- **Source:** `packages/fern-dashboard/src/components/ui/skeleton.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/skeleton.stories.tsx`

```tsx
import { Skeleton } from '@/components/ui/skeleton';
```

**Usage:**

```tsx
<Skeleton className="h-4 w-48" />
```

**Variants:** Default, Circle, Card, TextLines

### Steps

- **Source:** `packages/fern-dashboard/src/components/ui/steps.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/steps.stories.tsx`

```tsx
import { Steps, Step } from '@/components/ui/steps';
```

**Variants:** Default, WithCompletedSteps

### Switch

- **Source:** `packages/fern-dashboard/src/components/ui/switch.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/switch.stories.tsx`

```tsx
import { Switch } from '@/components/ui/switch';
```

**Props:**

- `disabled`: boolean

**Usage:**

```tsx
<Switch />
```

**Variants:** Default, Checked, Disabled, DisabledChecked, WithLabel

### Table

- **Source:** `packages/fern-dashboard/src/components/ui/table.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/table.stories.tsx`

```tsx
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
```

**Variants:** Default, Empty

### Tabs

- **Source:** `packages/fern-dashboard/src/components/ui/tabs.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/tabs.stories.tsx`

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

**Variants:** Default, ManyTabs

### TeleprompterTextOnHover

- **Source:** `packages/fern-dashboard/src/components/ui/TeleprompterTextOnHover.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/TeleprompterTextOnHover.stories.tsx`

```tsx
import { TeleprompterTextOnHover } from '@/components/ui/TeleprompterTextOnHover';
```

**Props:**

- `duration`: number
- `disabled`: boolean

**Usage:**

```tsx
<TeleprompterTextOnHover containerClassName="w-48">This is a very long text that will scroll when you hover over it because it overflows its container</TeleprompterTextOnHover>
```

**Variants:** Default, ShortText, FastScroll, SlowScroll, Disabled

### TextArea

- **Source:** `packages/fern-dashboard/src/components/ui/textarea.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/textarea.stories.tsx`

```tsx
import { TextArea } from '@/components/ui/textarea';
```

**Props:**

- `disabled`: boolean

**Usage:**

```tsx
<TextArea placeholder="Describe the plant species..." />
```

**Variants:** Default, WithValue, Disabled, Invalid

### Tooltip

- **Source:** `packages/fern-dashboard/src/components/ui/tooltip.tsx`
- **Stories:** `packages/fern-dashboard/src/components/ui/tooltip.stories.tsx`

```tsx
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
```

**Usage:**

```tsx
<Tooltip content="Create a new plant entry" />
```

**Variants:** Default, Top, Bottom, Left, Right, LongContent, EmptyContent

---

## Upsells

### SeatCounterContent

- **Source:** `packages/fern-dashboard/src/components/upsells/content/SeatCounterContent.tsx`
- **Stories:** `packages/fern-dashboard/src/components/upsells/content/SeatCounterContent.stories.tsx`

**Props:**

- `usedMembers`: number
- `currentMembers`: number
- `count`: number
- `isLoading`: boolean
- `isPriceLoading`: boolean
- `errorMessage`: text

**Variants:** AtMemberLimit, AddingSeatsMonthly, AddingSeatsYearly, RemovingSeats, LoadingPrice, ProcessingCheckout, ExceededProSeatLimit, CardDeclined, CardExpired, InsufficientFunds, NoSubscription, NoStripeCustomer, GenericError, PricePreviewError

### UpsellGate

- **Source:** `packages/fern-dashboard/src/components/upsells/UpsellGate.tsx`
- **Stories:** `packages/fern-dashboard/src/components/upsells/UpsellGate.stories.tsx`

**Props:**

- `feature`: `"seats"` | `"ai_credits"` | `"custom_domain_subpath"` | `"docs_sites"` | `"custom_domains"`
- `state`: `"entitled"` | `"not-entitled"` | `"loading"`

**Variants:** Entitled, NotEntitled, Loading, Interactive

### UpsellModal

- **Source:** `packages/fern-dashboard/src/components/upsells/UpsellModal.tsx`
- **Stories:** `packages/fern-dashboard/src/components/upsells/UpsellModal.stories.tsx`

**Props:**

- `feature`: `"seats"` | `"ai_credits"` | `"custom_domain_subpath"` | `"docs_sites"` | `"custom_domains"`
- `tier`: `"free"` | `"paid"` | `"enterprise"`
- `open`: boolean

**Variants:** Seats, SeatsPaid, SeatsEnterprise, AiCredits, AiCreditsPaid, CustomDomainSubpath, DocsSites, CustomDomains, CustomDomainsPaid

### Seat Purchase

- **Stories:** `packages/fern-dashboard/src/components/upsells/UpsellSeatPurchase.stories.tsx`

**Props:**

- `usedMembers`: number
- `currentMembers`: number
- `count`: number
- `isLoading`: boolean
- `isPriceLoading`: boolean
- `errorMessage`: text

**Variants:** AtMemberLimit, AddingSeatsMonthly, AddingSeatsYearly, RemovingSeats, LoadingPrice, ProcessingCheckout, ExceededProSeatLimit, StripeCardDeclined, StripeCardExpired, StripeInsufficientFunds, ErrorNoSubscription, ErrorNoStripeCustomer, ErrorGenericFailure, ErrorPricePreviewFailed

---

_Auto-generated by `pnpm generate-ai-components-md` — do not edit manually._
_Source: `packages/fern-dashboard/scripts/generate-ai-components-md.ts`_
