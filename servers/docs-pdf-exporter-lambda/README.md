# docs-pdf-exporter-lambda

Minimal local server app scaffold for PDF generation work.

## Local usage

```bash
pnpm -w install
pnpm -C servers/docs-pdf-exporter-lambda playwright:install
pnpm -C servers/docs-pdf-exporter-lambda dev:generate-docs-pdf
pnpm -C servers/docs-pdf-exporter-lambda dev:generate-cover-pdf
```
