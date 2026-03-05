# docs-pdf-exporter

Minimal local server app scaffold for PDF generation work.

## Local usage

```bash
pnpm -w install
pnpm -C servers/docs-pdf-exporter playwright:install
FERN_TOKEN=<vercel-docs-project-fern-token> pnpm -C servers/docs-pdf-exporter dev:generate-docs-pdf
FERN_TOKEN=<vercel-docs-project-fern-token> pnpm -C servers/docs-pdf-exporter dev:generate-cover-pdf
```
