export default {
    // This is duplicated, make sure to keep it in sync with others
    plugins: {
        "@tailwindcss/postcss": {},
        ...(process.env.NODE_ENV === "production" && process.env.NEXT_DISABLE_MINIFICATION !== "1"
            ? { cssnano: {} }
            : {})
    }
};
