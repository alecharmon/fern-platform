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
- **Dashboard**: Renders MDX rendering via `MdxContent`. Many components are Client Components with `"use client"` directive.

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

Parallel implementations use **shared utilities**:

1. Bundle/dashboard each implement their own component logic
2. Shared utility and UI primitives (collapse, separators, etc.) are imported from `@fern-docs/components`

This pattern keeps bundle as Server Components for optimal SSR performance while allowing dashboard to use Client Components.

## CSS Imports

Bundle and dashboard have parallel CSS entry points that must include specific imports for components to render correctly:

| Bundle | Dashboard |
|--------|-----------|
| `bundle/src/app/globals.css` | `dashboard/src/app/[orgName]/(visual-editor)/editor/[docsUrl]/[branch]/[...slug]/index.css` |

The `@fern-docs/components/styles` entry point does NOT include all component styles. Some styles must be imported separately or components will render without styling. Examples:

```css
@import "@fern-docs/components/src/syntax-highlighter/index.css";
@import "@fern-docs/components/src/api-reference/index.scss";
@import "@fern-docs/components/src/HorizontalOverflowMask.scss";
```
