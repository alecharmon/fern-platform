import { execSync } from "child_process";
import * as os from "os";
import path from "path";

const DEFAULT_BUNDLE_PATH = "~/.fern/app-preview-local/.next";

function setupLocalBundle(specifiedBundlePath?: string) {
  const originalCwd = process.cwd(); // Store original directory
  const bundlePath = specifiedBundlePath ?? DEFAULT_BUNDLE_PATH;

  // Resolve the bundle path (expand ~ to home directory)
  const resolvedPath = bundlePath.replace(/^~/, os.homedir());
  const absolutePath = path.resolve(resolvedPath);

  console.log(`Setting up local bundle in: ${absolutePath}`);

  try {
    // Change to the specified directory
    process.chdir(absolutePath);
    console.log(`Changed directory to: ${process.cwd()}`);

    // Run pnpm i esbuild
    console.log("Installing esbuild...");
    execSync("pnpm i esbuild", { stdio: "inherit" });

    // Run node install-esbuild.js
    console.log("Running install-esbuild.js...");
    execSync("node install-esbuild.js", { stdio: "inherit" });

    console.log("Local bundle setup completed successfully");
  } catch (error) {
    console.error("Error setting up local bundle:", error);
    throw error;
  } finally {
    // Always restore original directory
    process.chdir(originalCwd);
  }
}

/**
 * Command-line wrapper for setupLocalBundle.
 * Usage: tsx setup-local-bundle.ts [bundlePath]
 */
function mainSetupLocalBundle() {
  const [, , bundlePathArg] = process.argv;
  try {
    setupLocalBundle(bundlePathArg);
  } catch (err) {
    console.error(
      "Error setting up local bundle:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

// Allow running from command line
if (require.main === module) {
  void mainSetupLocalBundle();
}
