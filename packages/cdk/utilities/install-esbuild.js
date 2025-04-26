const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

const SKIP_DIRS = ["node_modules", ".git", "dist", "build"];

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
        `copy node_modules/.pnpm/esbuild@0.25.0 ${destPath}\\ && copy node_modules/.pnpm/@esbuild+* ${destPath}\\`
      );
    } else {
      await execAsync(
        `cp -r node_modules/.pnpm/esbuild@0.25.0 node_modules/.pnpm/@esbuild+* ${destPath}/`
      );
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

    const esbuildPackage = entries.find((entry) =>
      entry.startsWith("@esbuild+")
    );
    if (!esbuildPackage) return null;

    const match = esbuildPackage.match(/@esbuild\+(.+)@0\.25\.0/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Error checking imports:", error.message);
    return null;
  }
}

async function main() {
  try {
    const { platform, arch } = checkOS();
    console.log(
      `Replacing 'linux-x64' with '${platform}-${arch}' in .json files in ${targetDir}`
    );
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
