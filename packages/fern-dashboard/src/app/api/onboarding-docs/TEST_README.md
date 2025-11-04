# Onboarding Docs Test Script

This script allows you to test the entire onboarding docs flow end-to-end without going through the UI. It will:

1. Generate a Fern docs site at `<website-name>.docs.buildwithfern.com`
2. Upload the docs to S3 for download
3. Create a GitHub repository in the Fern organization with all the files

## Prerequisites

1. **Start the dev server:**
   ```bash
   pnpm dashboard:dev
   ```

2. Make sure you have the required environment variables set:
   - `FERN_TOKEN` (optional, for authentication)
   - `FERN_BOT_APP_ID` (required for GitHub repo creation)
   - `FERN_BOT_PRIVATE_KEY` (required for GitHub repo creation)
   - `FERN_GITHUB_ORG` (optional, defaults to "fern-api")
   - `ONBOARDING_ASSETS_S3_BUCKET_NAME` (required for S3 upload)

3. Make sure fern-bot is installed on the target organization

## Usage

```bash
pnpm tsx scripts/test-onboarding.ts <website-name>
```

Example:
```bash
pnpm tsx scripts/test-onboarding.ts jacobtestwebsite
```

## What it does

1. Creates a docs site with:
   - Site name: `<website-name> Docs`
   - URL: `<website-name>.docs.buildwithfern.com`
   - Default favicon and logo (placeholder images)
   - Default primary color (#0026e6)
   - No OpenAPI specs (minimal setup)

2. Generates the Fern project structure from templates

3. Runs `fern generate --docs` to publish the docs

4. Uploads the fern directory to S3 as a zip file

5. Creates a GitHub repository at `https://github.com/<FERN_GITHUB_ORG>/<website-name>-docs-buildwithfern-com`

## Output

On success, you'll see:
```
✅ Success!

Results:
  📄 Docs URL: https://jacobtestwebsite.docs.buildwithfern.com
  📦 Download URL: https://s3.amazonaws.com/...
  🐙 GitHub Repo: https://github.com/fern-api/jacobtestwebsite-docs-buildwithfern-com

CLI Output:
[Fern CLI output]
```

## Customization

You can customize the test data by editing `testScript.ts`:

```typescript
const testData: OnboardingDocsRequest = {
    docsSiteName: `${websiteName} Docs`,
    orgName: "jacob-schein-personal-project", // Update this to your org
    docsSiteUrl: websiteName,
    docsSiteUrlAvailable: true,
    faviconUrl: "https://via.placeholder.com/32x32/0026e6/ffffff?text=F",
    logoUrl: "https://via.placeholder.com/200x40/0026e6/ffffff?text=Fern",
    primaryColorHex: "#0026e6",
    existingDocsSite: "",
    openApiSpecUrls: [] // Add OpenAPI specs here if needed
};
```

## Troubleshooting

### GitHub repository creation fails
- Check that `FERN_BOT_APP_ID` and `FERN_BOT_PRIVATE_KEY` are set
- Verify fern-bot is installed on the target organization
- Check logs for specific error messages

### Fern generate fails
- Check that the template files are valid
- Verify `FERN_TOKEN` is set (if required)
- Check the CLI output for validation errors

### S3 upload fails
- Verify `ONBOARDING_ASSETS_S3_BUCKET_NAME` is set
- Check AWS credentials are configured
- Ensure the bucket exists and has proper permissions
