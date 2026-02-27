# docs-pdf-exporter-lambda

Minimal local server app scaffold for PDF generation work.

## Local usage

```bash
pnpm -w install
pnpm -C servers/docs-pdf-exporter-lambda playwright:install
PDF_EXPORT_TOKEN=<vercel-docs-project-fern-token> pnpm -C servers/docs-pdf-exporter-lambda dev:generate-docs-pdf
PDF_EXPORT_TOKEN=<vercel-docs-project-fern-token> pnpm -C servers/docs-pdf-exporter-lambda dev:generate-cover-pdf
```
