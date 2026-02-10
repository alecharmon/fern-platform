# @fern-dashboard/src/utils/openapi-resolver

<!-- AI: Update the date below when modifying this file -->
*Last updated by AI: 2026-02-10*

Resolution layer for mapping FDR description targets to OpenAPI spec locations. Used by the [`api-reference/`](../../docs/components/api-reference/README.md) components in the [editor](../../components/editor/README.md).

## Key Files

| File | Purpose |
|------|---------|
| `resolver.ts` | `OpenApiResolver` class - maps `DescriptionTarget` → `{filePath, jsonPath}` |
| `types.ts` | `DescriptionTarget` union type, `OpenApiLocation`, `OpenApiWriteResult` |
| `yaml-utils.ts` | YAML/JSON manipulation: `updateYamlValue()`, `createOverrideContent()`, `createParameterOverrideContent()` |
| `ref-utils.ts` | `$ref` parsing and resolution utilities |

## Tests

```bash
pnpm --filter=@fern-dashboard/ui test src/utils/openapi-resolver/
```
