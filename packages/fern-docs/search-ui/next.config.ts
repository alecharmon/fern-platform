import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@fern-api/fdr-sdk", "@fern-api/ui-core-utils"],
    experimental: {
        optimizePackageImports: [
            "lucide-react",
            "@fern-api/fdr-sdk",
            "@fern-api/ui-core-utils",
            "@fern-docs/components",
            "@fern-docs/mdx",
            "@fern-docs/search-keyword",
            "@fern-docs/search-utils",
            "@fern-docs/search-ask-fern",
            "@fern-api/docs-utils",
            "@fern-ui/react-commons"
        ],
        optimizeServerReact: true
    }
};

export default nextConfig;
