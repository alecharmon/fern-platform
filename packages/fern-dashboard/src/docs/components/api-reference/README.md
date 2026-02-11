# @fern-dashboard/src/docs/components/api-reference

<!-- AI: Update the date below when modifying this file -->
*Last updated by AI: 2026-02-06*

Editor components for rendering OpenAPI specs, editing descriptions, and writing changes to an OpenAPI spec overrides file.

## Supported Targets

Description editing is currently supported only for **OpenAPI HTTP endpoints**. Other endpoint types and API formats render correctly but are read-only.

### Endpoint Types

| Endpoint Type | Renders | Editable | Notes |
|---------------|---------|----------|-------|
| HTTP | Yes | Yes | Full support via OpenAPI resolver |
| HTTP (streaming) | Yes | Yes | SSE and streaming responses are still HTTP endpoints |
| WebSocket | Yes | No | Read-only, not standard OpenAPI operations |
| Webhook | Yes | No | Read-only, not standard OpenAPI operations |
| gRPC | Yes | No | Read-only, uses proto format |

### API Definition Formats

| Format | Renders | Editable | Notes |
|--------|---------|----------|-------|
| OpenAPI 3.x | Yes | Yes | Full editing support |
| AsyncAPI | Yes | No | Different spec format, not yet supported |
| OpenRPC | Yes | No | Different spec format, not yet supported |
| Proto/gRPC | Yes | No | Different spec format, not yet supported |
| Fern Definition | Yes | No | Internal format, not yet supported |

### Why Some Things Aren't Editable

Non-editable descriptions show a mouse-following tooltip on hover explaining why editing is disabled:

| Reason Code | Cause | When It Appears |
|-------------|-------|-----------------|
| `unsupported-protocol` | WebSocket channels or Webhooks | Hover on description in WebSocket/Webhook page |
| `non-openapi-format` | AsyncAPI, OpenRPC, gRPC, or Fern Definition | Hover on description in gRPC page |
| `security-scheme-not-supported` | Authentication/security scheme descriptions | Hover on description in Auth section |
| `composition-type` | allOf/oneOf/anyOf composition | Hover on property using allOf/oneOf/anyOf |
| `unsupported-ref` | Circular refs or complex patterns | Hover on property with unresolvable `$ref` |
| `not-found` | Element doesn't exist in any spec | Hover on description not found in specs |
| `editing-not-available` | No edit target context | No `ApiEditTargetProvider` in tree |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        1. SERVER LAYER                              │
│  EditorProvidersWrapper (server component)                          │
│  - Fetches specs from GitHub via GitHubLoader.getApiSpecs()         │
│  - Returns: specs, sourceType, overrideFilePaths, generatorsYml     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       2. CONTEXT LAYER                              │
│  OpenApiSpecsProvider (combined data + editing)                     │
│  - Holds specs Map<filePath, content>                               │
│  - Tracks pendingChanges (persisted to IndexedDB)                   │
│  - Creates OpenApiResolver from specs                               │
│  - Manages editing state + orchestrates save flow                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       3. RESOLUTION LAYER                           │
│  OpenApiResolver                                                    │
│  - Maps DescriptionTarget → OpenAPI location (filePath + jsonPath)  │
│  - resolve(): finds current description location                    │
│  - resolveWriteLocation(): determines where to WRITE                │
│  - getDescriptionValue(): extracts value from specs                 │
│                                                                     │
│  YAML Utils                                                         │
│  - updateYamlValue(): updates value at jsonPath                     │
│  - createOverrideContent(): creates minimal override YAML           │
└─────────────────────────────────────────────────────────────────────┘
```

## Override File Strategy

Override files allow editing API descriptions without modifying the main OpenAPI spec.

1. **First edit**: If no override file exists, a new one is created
2. **Subsequent edits**: Writes go to existing override file
3. **generators.yml**: Automatically updated to reference new override files

```yaml
api:
  specs:
    - openapi: openapi/openapi.yaml
      overrides: openapi/openapi-overrides.yaml  # Added automatically if it doesn't exist yet
```

### Supported File Formats

Both YAML and JSON formats are fully supported:

| Main Spec Format | Override File Format | Notes |
|------------------|---------------------|-------|
| `.yaml` | `.yaml` | Override matches main spec format |
| `.yml` | `.yaml` | Override uses canonical `.yaml` extension |
| `.json` | `.json` | Override matches main spec format |

**Format handling:**
- **Reading**: Both YAML and JSON are parsed transparently via `yaml.load()` (js-yaml handles both)
- **Updating existing files**: Format is auto-detected by content (starts with `{` or `[` → JSON, otherwise YAML)
- **Creating new override files**: Format matches the main spec's file extension

## Key Files (outside api-reference/)

| File | Purpose |
|------|---------|
| `src/providers/OpenApiSpecsContext.tsx` | Specs data, pending changes, resolver, edit state, save flow |
| [`src/utils/openapi-resolver/`](../../../utils/openapi-resolver/README.md) | Resolution layer (resolver, types, ref-utils, yaml-utils) |
| [`src/components/editor/`](../../../components/editor/README.md) `EditorProvidersWrapper.tsx` | Server component that fetches specs via GitHubLoader |
| [`src/components/editor/`](../../../components/editor/README.md) `DescriptionEditButton.tsx` | Edit button that appears on hover |
| [`src/components/editor/`](../../../components/editor/README.md) `MouseFollowingTooltip.tsx` | Tooltip that follows cursor for non-editable descriptions |
| [`src/components/editor/`](../../../components/editor/README.md) `DescriptionEditModal.tsx` | Modal for editing descriptions |
| [`src/components/editor/git/`](../../../components/editor/README.md) `CommitButton.tsx` | Commits pending changes to GitHub |
| `src/app/services/github/github-loader.ts` | `getApiSpecs()` fetches specs from GitHub |
| [`@fern-docs/components`](../../../../../fern-docs/components/README.md) `NavigationStore.ts` | Stores `openApiPendingChanges` map, persisted to IndexedDB |

## Editable Description Types

The `DescriptionTarget` discriminated union in `types.ts` defines all description target locations. The union also includes non-editable types (`websocket`, `webhook`, `grpc`) used for rendering read-only descriptions. The editable targets are:

- **endpoint** - Operation description
- **schema** - Component schema description
- **property** - Object property description (supports nested paths)
- **parameter** - Path/query/header/cookie parameter description
- **requestBody** - Request body description
- **requestBodyProperty** - Request body property description
- **response** - Response description
- **responseProperty** - Response body property description
- **enumValue** - Enum value description (via `x-enum-descriptions`)
- **formDataField** - Multipart form field description

An edit button appears on hover even when no description exists.

## Limitations

- **Format**: Only OpenAPI 3.x specs are editable (AsyncAPI, OpenRPC, gRPC, Fern Definition are read-only)
- **Protocol**: Only HTTP endpoints are editable (WebSocket channels and Webhooks are read-only)
- **Composition types**: allOf/oneOf/anyOf schemas are not editable (complex merge semantics)
- **YAML formatting**: Saving reformats the entire file using js-yaml's default formatting

## Future: Adding Support for More Protocols

### Webhooks (OpenAPI 3.1)

Webhooks in OpenAPI 3.1 use the same `PathItemObject` structure as `paths`:

```yaml
webhooks:
  orderCreated:
    post:
      description: "..."  # Same structure as paths.{path}.{method}.description
```

**Implementation would require:**

1. **types.ts**: Add `webhooks?: Record<string, PathItemObject>` to `ParsedOpenApiSpec`
2. **types.ts**: Add `method: string` to `WebhookDescriptionTarget` (currently only has `webhookId`)
3. **resolver.ts**: Extend `resolveEndpoint()` to handle both `paths` and `webhooks` collections
4. **OpenApiSpecsContext.tsx**: Remove `webhook` from the "unsupported-protocol" early return
5. **ApiEditTargetContext.tsx**: Update `createWebhookEditTarget()` to include `method`
6. **WebhookContent.tsx**: Replace `EditableWebhookDescription` with actual editing (copy pattern from `EndpointContent.tsx`)

### WebSockets (Requires New Resolver)

WebSocket channels use different spec formats (not OpenAPI):

| Source | Structure | JSON Path |
|--------|-----------|-----------|
| AsyncAPI | `channels.{name}.description` | `["channels", "orders", "description"]` |
| Fern Definition | `channel.path` | Custom format |

**Implementation would require:**

1. Create `src/utils/asyncapi-resolver/` module (or `fern-definition-resolver/`)
2. Update `github-loader.ts` to fetch AsyncAPI/Fern Definition files
3. Update `OpenApiSpecsContext.tsx` to select resolver based on `sourceType`
4. Update `WebSocketContent.tsx` to enable editing UI
