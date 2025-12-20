import postcssNesting from "postcss-nesting";

export default {
    // This is duplicated, make sure to keep it in sync with others
    plugins: [postcssNesting(), "@tailwindcss/postcss", ...(process.env.NODE_ENV === "production" ? ["cssnano"] : [])]
};
