# Endpoint Definition to OpenAPI Snapshot Testing

This directory contains snapshot tests for the `endpointDefinitionToOpenApi` functionality.

## Test Structure

- **`test_runner.test.ts`**: Main test runner that discovers and runs all test cases
- **`test_cases/`**: Directory containing individual YAML test case files

## Test Case Format

Each test case file in `test_cases/` should follow this YAML structure:

```yaml
endpoint_input:
  openapi: 3.1.1 # etc...

endpoint_definitions: {}

output: |
  # Expected OpenAPI YAML output
```

## Running Tests

### Normal Test Run

```bash
pnpm test src/server/__test__/endpointDefinitionToOpenApi/test_runner.test.ts
```

### Update Snapshots

To update snapshots when test outputs change:

```bash
UPDATE_SNAPSHOTS=true pnpm test src/server/__test__/endpointDefinitionToOpenApi/test_runner.test.ts
```
