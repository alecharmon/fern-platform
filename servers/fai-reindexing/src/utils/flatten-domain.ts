// Sanitizes domain for use in path-param APIs (job tracker, content hash, etc.).
// For basepath multi-repo domains (e.g. "docs.nvidia.com/nemo"), replaces "/" with "_"
// to avoid breaking Fern SDK path-param encoding (which would double-encode %2F).
export function flattenDomain(domain: string): string {
    return domain.replace(/\//g, "_");
}
