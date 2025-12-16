# @fern-docs/components

Shared React components for Fern documentation sites.

## API Reference Components

The `api-reference/` directory contains components for rendering API documentation. These components follow a three-tier architecture:

1. **Shared components** (`@fern-docs/components`) - Core logic, utilities, and UI primitives
2. **Bundle implementations** (`@fern-docs/bundle`) - Server-side MDX rendering
3. **Dashboard implementations** (`@fern-dashboard/ui`) - Client-side MDX rendering

### Parallel Implementation Pattern

Some components require parallel implementations in bundle and dashboard due to differing MDX rendering strategies:

- **Bundle**: Uses server-side MDX rendering via `MdxServerComponentProseSuspense`. Most components are Server Components for optimal performance.
- **Dashboard**: Uses client-side MDX rendering via `MdxContent`. Most components are Client Components with `"use client"` directive.

These components form a recursive rendering tree where type definitions can contain nested types, each requiring MDX-rendered descriptions.

### Components Requiring Parallel Implementations

The following components in `api-reference/type-definitions/` require platform-specific implementations in both bundle and dashboard:

| Component | Purpose | Bundle Location | Dashboard Location |
|-----------|---------|-----------------|-------------------|
| `InternalTypeDefinition` | Renders type shapes (enum, union, object) | `bundle/.../type-definitions/InternalTypeDefinition.tsx` | `dashboard/.../type-definitions/InternalTypeDefinition.tsx` |
| `ObjectProperty` | Renders object properties with MDX descriptions | `bundle/.../type-definitions/ObjectProperty.tsx` | `dashboard/.../type-definitions/ObjectProperty.tsx` |
| `EnumValue` | Renders enum values with MDX descriptions | `bundle/.../type-definitions/EnumValue.tsx` | `dashboard/.../type-definitions/EnumValue.tsx` |
| `DiscriminatedUnionVariant` | Renders discriminated union variants | `bundle/.../type-definitions/DiscriminatedUnionVariant.tsx` | `dashboard/.../type-definitions/DiscriminatedUnionVariant.tsx` |
| `UndiscriminatedUnionVariant` | Renders undiscriminated union variants | `bundle/.../type-definitions/UndiscriminatedUnionVariant.tsx` | `dashboard/.../type-definitions/UndiscriminatedUnionVariant.tsx` |
| `TypeReferenceDefinitions` | Resolves type references and renders definitions | `bundle/.../type-definitions/TypeReferenceDefinitions.tsx` | `dashboard/.../type-definitions/TypeReferenceDefinitions.tsx` |
| `TypeDefinitionSlotsServer` | Provides pre-rendered type slots | `bundle/.../type-definitions/TypeDefinitionSlotsServer.tsx` | `dashboard/.../type-definitions/TypeDefinitionSlotsServer.tsx` |

### Implementation Pattern

Parallel implementations use ** shared utilities**:

1. Bundle/dashboard each implement component logic inline
2. Shared utility and UI primitives (collapse, separators, etc.) are imported from `@fern-docs/components`

This pattern keeps bundle as Server Components for optimal SSR performance while allowing dashboard to use Client Components.
