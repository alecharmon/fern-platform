import { createRequire } from "module";
import postcssNesting from "postcss-nesting";

const require = createRequire(import.meta.url);
const scopePlugin = require("./postcss-scope-plugin.cjs");

export default {
    // This is duplicated, make sure to keep it in sync with others
    plugins: [
        postcssNesting(),
        "@tailwindcss/postcss",
        scopePlugin(),
        ...(process.env.NODE_ENV === "production" ? ["cssnano"] : [])
    ]
};
