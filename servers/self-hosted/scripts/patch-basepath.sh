#!/bin/bash
# patch-basepath.sh - Replace the build-time basePath placeholder with the runtime value.
#
# The Next.js bundle is built with NEXT_PUBLIC_BASE_PATH="/__FERN_BP__" as a placeholder.
# At container startup, this script replaces that placeholder with the actual basePath
# (from the NEXT_PUBLIC_BASE_PATH env var) or removes it entirely for root serving.
#
# This allows a single Docker image to serve docs from any basePath (e.g., /docs)
# or from root (/) without rebuilding.

set -e

_BP_PLACEHOLDER="/__FERN_BP__"
_BP_NEXTAPP_DIR="/nextapp"
_BP_ACTUAL="${NEXT_PUBLIC_BASE_PATH:-}"

_bp_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [patch-basepath] $*"
}

if [ "$_BP_ACTUAL" = "$_BP_PLACEHOLDER" ]; then
    _bp_log "WARNING: NEXT_PUBLIC_BASE_PATH is set to the placeholder value itself. Treating as no basePath."
    _BP_ACTUAL=""
fi

# Check if placeholder still exists in the bundle.
# If it was already patched at build time (via generate.sh), there's nothing to do.
_BP_HAS_PLACEHOLDER=$(find "$_BP_NEXTAPP_DIR" -type f \( -name "*.js" -o -name "*.html" -o -name "*.json" -o -name "*.css" -o -name "*.mjs" \) -exec grep -l "$_BP_PLACEHOLDER" {} + 2>/dev/null | head -1 || true)
if [ -z "$_BP_HAS_PLACEHOLDER" ]; then
    _bp_log "No files contain placeholder '$_BP_PLACEHOLDER' - basePath was already patched at build time. Skipping runtime patching."
    export NEXT_PUBLIC_BASE_PATH="$_BP_ACTUAL"
    return 0 2>/dev/null || exit 0
fi

if [ -z "$_BP_ACTUAL" ]; then
    _bp_log "No NEXT_PUBLIC_BASE_PATH set - patching placeholder to serve from root /"
else
    _bp_log "Patching placeholder to serve from basePath: $_BP_ACTUAL"
fi

# Use find + grep -l instead of grep --include (not supported in BusyBox/Wolfi).
_BP_PATCHED=0
while IFS= read -r _bp_file; do
    if [ -z "$_BP_ACTUAL" ]; then
        # For root serving (empty basePath), we must handle three escaping contexts
        # (longest pattern first to avoid partial matches):
        #
        # 1. JSON/JS string literals: \\/__FERN_BP__ (two backslashes in file)
        #    e.g. routes-manifest.json regex: "^\\/__FERN_BP__(?:\\/"
        #    Without this fix, removing just /__FERN_BP__ leaves \( which is
        #    an invalid JSON escape ("Bad escaped character in JSON").
        #
        # 2. Regex literals in JS: \/__FERN_BP__ (one backslash in file)
        #    e.g. compiled route matcher: /^\/__FERN_BP__(?:\/...$/
        #    Without this fix, ^\/__FERN_BP__(?:... becomes ^\(?:... (broken regex).
        #
        # 3. Plain URL paths: /__FERN_BP__ (no backslash)
        #    e.g. HTML src, CSS url(), JS string URLs
        sed -i "s|\\\\\\\\/__FERN_BP__||g" "$_bp_file"
        sed -i "s|\\\\/__FERN_BP__||g" "$_bp_file"
        sed -i "s|/__FERN_BP__||g" "$_bp_file"
    else
        sed -i "s|$_BP_PLACEHOLDER|$_BP_ACTUAL|g" "$_bp_file"
    fi
    _BP_PATCHED=$((_BP_PATCHED + 1))
done < <(find "$_BP_NEXTAPP_DIR" -type f \( -name "*.js" -o -name "*.html" -o -name "*.json" -o -name "*.css" -o -name "*.mjs" \) -exec grep -l "$_BP_PLACEHOLDER" {} + 2>/dev/null || true)

if [ "$_BP_PATCHED" -gt 0 ]; then
    _bp_log "Patched $_BP_PATCHED files"
else
    _bp_log "WARNING: No files found containing placeholder '$_BP_PLACEHOLDER' - basePath may not work correctly"
fi

# For the no-basePath case (root serving), fix Next.js config files.
# When basePath is sed'd from "/__FERN_BP__" to "", the JSON manifests end up with
# basePath: "" which Next.js treats differently from basePath being absent/undefined.
# We need to remove or nullify basePath in the config so Next.js behaves as if
# no basePath was ever configured.
if [ -z "$_BP_ACTUAL" ]; then
    _bp_log "Fixing Next.js config files for root serving (removing empty basePath)..."
    _BP_BUNDLE_DIR="$_BP_NEXTAPP_DIR/packages/fern-docs/bundle"

    # Fix required-server-files.json - this is the main config Next.js reads at startup
    _BP_RSF="$_BP_BUNDLE_DIR/.next/required-server-files.json"
    if [ -f "$_BP_RSF" ]; then
        node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('$_BP_RSF', 'utf8'));
            if (data.config) {
                delete data.config.basePath;
                delete data.config.assetPrefix;
            }
            fs.writeFileSync('$_BP_RSF', JSON.stringify(data));
        " 2>/dev/null && _bp_log "Fixed $_BP_RSF" || _bp_log "WARNING: Could not fix $_BP_RSF"
    fi

    # Fix routes-manifest.json - route definitions
    _BP_RM="$_BP_BUNDLE_DIR/.next/routes-manifest.json"
    if [ -f "$_BP_RM" ]; then
        node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('$_BP_RM', 'utf8'));
            if ('basePath' in data) delete data.basePath;
            fs.writeFileSync('$_BP_RM', JSON.stringify(data));
        " 2>/dev/null && _bp_log "Fixed $_BP_RM" || _bp_log "WARNING: Could not fix $_BP_RM"
    fi
fi

# Export the final base path for downstream scripts (run.sh, generate.sh)
export NEXT_PUBLIC_BASE_PATH="$_BP_ACTUAL"
_bp_log "Done. NEXT_PUBLIC_BASE_PATH='$_BP_ACTUAL'"
