import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    target: "node22",
    platform: "node",
    outDir: "dist",
    clean: true,
    bundle: true,
    minify: false,
    sourcemap: false,
    external: ["@prisma/client", ".prisma/client"],
    outExtension: () => ({ js: ".js" }),
    onSuccess: async () => {
        const distDir = path.join(process.cwd(), "dist");
        const nodeModulesDir = path.join(distDir, "node_modules");

        fs.mkdirSync(nodeModulesDir, { recursive: true });

        const workspaceRoot = path.join(process.cwd(), "../..");
        const workspaceNodeModules = path.join(workspaceRoot, "node_modules/.pnpm");

        const pnpmDirs = fs.readdirSync(workspaceNodeModules);

        const prismaClientDirs = pnpmDirs.filter((dir) => dir.startsWith("@prisma+client@"));

        if (prismaClientDirs.length === 0) {
            throw new Error("Could not find @prisma/client in pnpm store");
        }

        const prismaClientDir = path.join(
            workspaceNodeModules,
            prismaClientDirs[0],
            "node_modules",
            "@prisma",
            "client"
        );
        const destPrismaClientDir = path.join(nodeModulesDir, "@prisma", "client");

        fs.mkdirSync(path.dirname(destPrismaClientDir), { recursive: true });
        execSync(`cp -r "${prismaClientDir}" "${path.dirname(destPrismaClientDir)}"`);

        const dotPrismaClientDir = path.join(
            workspaceNodeModules,
            prismaClientDirs[0],
            "node_modules",
            ".prisma",
            "client"
        );
        const destDotPrismaClientDir = path.join(nodeModulesDir, ".prisma", "client");

        fs.mkdirSync(path.dirname(destDotPrismaClientDir), { recursive: true });
        execSync(`cp -r "${dotPrismaClientDir}" "${path.dirname(destDotPrismaClientDir)}"`);

        const prismaSchemaSource = path.join(process.cwd(), "../../servers/fdr/prisma");
        const prismaSchemaDestDir = path.join(distDir, "prisma");
        fs.mkdirSync(prismaSchemaDestDir, { recursive: true });
        execSync(`cp -r "${prismaSchemaSource}"/* "${prismaSchemaDestDir}"`);
    }
});
