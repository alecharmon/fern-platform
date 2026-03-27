import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, join } from "path";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return dirname(require.resolve(join(value, "package.json")));
}

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(ts|tsx)"],

    staticDirs: ["../public"],

    addons: [getAbsolutePath("@storybook/addon-links")],

    framework: {
        name: getAbsolutePath("@storybook/react-vite") as "@storybook/react-vite",
        options: {}
    },

    viteFinal: async (config) => {
        const path = await import("path");
        const tailwindcss = await import("@tailwindcss/vite");
        const react = await import("@vitejs/plugin-react");

        config.resolve ??= {};
        config.resolve.alias ??= {};

        // Mirror the tsconfig @/* path alias
        (config.resolve.alias as Record<string, string>)["@"] = path.resolve(__dirname, "../src");

        // Stub out Next.js modules that are not available outside of Next
        (config.resolve.alias as Record<string, string>)["next/navigation"] = path.resolve(
            __dirname,
            "./mocks/next-navigation.ts"
        );
        (config.resolve.alias as Record<string, string>)["next/dynamic"] = path.resolve(
            __dirname,
            "./mocks/next-dynamic.tsx"
        );

        // Stub next/image to avoid process is not defined error
        (config.resolve.alias as Record<string, string>)["next/image"] = path.resolve(
            __dirname,
            "./mocks/next-image.tsx"
        );

        // Stub server-only to prevent errors in Storybook
        (config.resolve.alias as Record<string, string>)["server-only"] = path.resolve(
            __dirname,
            "./mocks/server-only.ts"
        );

        // Add plugins
        config.plugins ??= [];
        config.plugins.push(react.default());
        config.plugins.push(tailwindcss.default());

        return config;
    },

    docs: {
        autodocs: "tag"
    },

    typescript: {
        reactDocgen: "react-docgen-typescript"
    }
};

export default config;
