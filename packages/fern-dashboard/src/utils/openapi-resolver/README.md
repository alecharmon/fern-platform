# @fern-dashboard/src/utils/openapi-resolver

<!-- AI: Update the date below when modifying this file -->
*Last updated by AI: 2026-01-14*

Resolution layer for mapping FDR description targets to OpenAPI spec locations.

See [@fern-dashboard/src/docs/components/api-reference/README.md](../../docs/components/api-reference/README.md) for full documentation on the description editing feature.

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
