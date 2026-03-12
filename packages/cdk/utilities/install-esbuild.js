const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

const SKIP_DIRS = ["node_modules", ".git", "dist", "build"];

/**
 * Check if the current platform's esbuild binary is already present in the
 * standalone bundle. When all platform binaries are shipped in the bundle
 * (e.g. @esbuild/darwin-arm64, @esbuild/linux-x64, etc.), no JSON fixup
 * or binary copying is needed — esbuild's own runtime resolution picks the
 * correct binary based on os.platform() + os.arch().
 *
 * Returns true if the platform binary is found, false otherwise.
 */
async function hasPlatformBinary(standaloneDir, platform, arch) {
    const target = `${platform}-${arch}`;
    const pnpmDir = path.join(standaloneDir, "node_modules", ".pnpm");

    try {
        const entries = await fs.readdir(pnpmDir);
        // Look for @esbuild+{platform}-{arch}@{version} directory
        const found = entries.some((entry) => entry.startsWith(`@esbuild+${target}@`));
        return found;
    } catch {
        // .pnpm dir doesn't exist or can't be read — binaries not pre-shipped
        return false;
    }
}

async function processFiles(dir, platform, arch) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
            await processFiles(fullPath, platform, arch);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            let content = await fs.readFile(fullPath, "utf8");

            if (content.includes("linux-x64")) {
                const replacement = `${platform}-${arch}`;
                content = content.replace(/linux-x64/g, replacement);
                await fs.writeFile(fullPath, content, "utf8");
            }
        }
    }
}

const targetDir = path.join(__dirname, "./standalone");

function checkOS() {
    const platform = os.platform();
    const arch = os.arch();
    return { platform, arch };
}

async function copyModules(destPath) {
    const isWindows = os.platform() === "win32";

    try {
        if (isWindows) {
            await execAsync(
                `copy node_modules/.pnpm/esbuild@0.27.0 ${destPath}\\ && copy node_modules/.pnpm/@esbuild+* ${destPath}\\`
            );
        } else {
            await execAsync(`cp -r node_modules/.pnpm/esbuild@0.27.0 node_modules/.pnpm/@esbuild+* ${destPath}/`);
        }
    } catch (error) {
        console.error("Error copying modules:", error.message);
        throw error;
    }
}

async function checkImport() {
    try {
        const pnpmDir = path.resolve("node_modules/.pnpm");
        const entries = await fs.readdir(pnpmDir);

        const esbuildPackage = entries.find((entry) => entry.startsWith("@esbuild+"));
        if (!esbuildPackage) {
            return null;
        }

        const match = esbuildPackage.match(/@esbuild\+(.+)@[\d.]+/);
        return match ? match[1] : null;
    } catch (error) {
        console.error("Error checking imports:", error.message);
        return null;
    }
}

async function main() {
    try {
        const { platform, arch } = checkOS();
        const target = `${platform}-${arch}`;

        // Check if the bundle already ships all platform binaries.
        // If so, esbuild's runtime resolution will find the correct binary
        // and no JSON fixup or binary copying is needed.
        const alreadyShipped = await hasPlatformBinary(targetDir, platform, arch);
        if (alreadyShipped) {
            console.log(
                `Platform binary @esbuild/${target} already present in standalone — skipping install-esbuild.js`
            );
            return;
        }

        // Legacy path: bundle was built with only linux-x64 binary.
        // Replace references in JSON trace files and copy the correct binary.
        console.log(`Platform binary @esbuild/${target} not found in standalone — running legacy fixup`);
        console.log(`Replacing 'linux-x64' with '${target}' in .json files in ${targetDir}`);
        await processFiles(targetDir, platform, arch);

        const importName = await checkImport();
        if (importName) {
            console.log(`Found esbuild import: ${importName}`);

            const destPath = path.resolve("./standalone/node_modules/.pnpm");
            await copyModules(destPath);
            console.log(`Modules copied to ${destPath}`);
        }
    } catch (error) {
        console.error("Error in main process:", error.message);
        process.exit(1);
    }
}

void main();
