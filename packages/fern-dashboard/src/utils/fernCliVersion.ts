export async function getLatestFernCliVersion(): Promise<string | undefined> {
    try {
        const response = await fetch("https://registry.npmjs.org/fern-api/latest");
        if (!response.ok) {
            console.error(`Failed to fetch latest fern-cli version: ${response.statusText}`);
            return undefined;
        }

        const data = await response.json();
        return data.version;
    } catch (error) {
        console.error("Failed to fetch latest fern-cli version", error);
        return undefined;
    }
}

/**
 * FERN EDITOR MIN VERSION:
 * This is the minimum version of the Fern CLI that is recommended to use the Fern Editor.
 * Prior to this version, the rawMarkdown field is not available in the docs definition.
 *
 * Please update this value when we have new recommended minimum versions so that we surface
 * a warning note to users who are using older versions.
 */
export const MIN_VE_CLI_VERSION = "0.69.0";

/**
 * Compares two versions and returns true if the first version is less than the second version.
 *
 * @param version - The version to compare
 * @param versionToCompareAgainst - The version to compare against
 * @returns boolean
 */
export function compareVersions(version: string, versionToCompareAgainst: string): boolean {
    if (version === "*") {
        return false;
    }
    const v1 = parseVersion(version);
    const v2 = parseVersion(versionToCompareAgainst);

    if (v1.major < v2.major) {
        return true;
    }
    if (v1.major > v2.major) {
        return false;
    }

    if (v1.minor < v2.minor) {
        return true;
    }
    if (v1.minor > v2.minor) {
        return false;
    }

    return v1.patch < v2.patch;
}

function parseVersion(version: string): {
    major: number;
    minor: number;
    patch: number;
} {
    // Extract core version (major.minor.patch)
    // Split on hyphen or plus to separate pre-release/build metadata
    const coreVersion = version.split(/[-+]/)[0] ?? "";
    const parts = coreVersion.split(".").map(Number);
    return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
    };
}
