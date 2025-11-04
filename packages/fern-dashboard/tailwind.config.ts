import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

const round = (num: number): string =>
    num
        .toFixed(7)
        .replace(/(\.[0-9]+?)0+$/, "$1")
        .replace(/\.0$/, "");

const em = (px: number, base: number): string => `${round(px / base)}em`;

const config: Config = {
    theme: {
        container: {
            queries: {
                xs: "20rem",
                sm: "24rem",
                md: "28rem",
                lg: "32rem",
                xl: "36rem",
                "2xl": "42rem"
            }
        },
        extend: {
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))"
            },
            keyframes: {
                "slide-down": {
                    "0%": {
                        transform: "translateY(-150%)"
                    },
                    "100%": {
                        transform: "translateY(0)"
                    }
                },
                shimmer: {
                    "0%": {
                        backgroundPosition: "-200% center"
                    },
                    "100%": {
                        backgroundPosition: "200% center"
                    }
                }
            },
            animation: {
                "slide-down": "slide-down 1s ease-in-out forwards",
                shimmer: "shimmer 3s infinite"
            },
            typography: {
                DEFAULT: {
                    css: {
                        maxWidth: "unset",
                        "--tw-prose-bold": "inherit",
                        "--tw-prose-body": "var(--gray-1100)",
                        "--tw-prose-bullets": "var(--gray-900)",
                        "--tw-prose-captions": "var(--gray-1100)",
                        "--tw-prose-code": "var(--green-1100)",
                        "--tw-prose-code-bg": "var(--gray-200)",
                        "--tw-prose-counters": "var(--gray-1000)",
                        "--tw-prose-headings": "inherit",
                        "--tw-prose-th-borders": "var(--color-border-default)",
                        "--tw-prose-hr": "var(--color-border-default)",
                        "--tw-prose-kbd": "var(--gray-1100)",
                        "--tw-prose-kbd-shadows": "var(--color-border-default)",
                        "--tw-prose-lead": "var(--gray-1100)",
                        "--tw-prose-links": "var(--green-1100)",
                        "--tw-prose-pre-bg": "var(--gray-200)",
                        "--tw-prose-pre-code": "var(--gray-1100)",
                        "--tw-prose-quote-borders": "var(--green-600)",
                        "--tw-prose-quotes": "var(--gray-1100)",
                        "--tw-prose-td-borders": "var(--color-border-default)",

                        "tbody td[rowspan]:first-child, tfoot td[rowspan]:first-child": {
                            paddingRight: em(8, 14)
                        },
                        "tbody td[rowspan]:first-child + td, tfoot td[rowspan]:first-child + td": {
                            paddingLeft: 0
                        },

                        // remove quotes from code blocks
                        "code::before": {
                            content: ""
                        },
                        "code::after": {
                            content: ""
                        },

                        // remove opening and closing quotes
                        "blockquote p:first-of-type::before": {
                            content: ""
                        },
                        "blockquote p:last-of-type::after": {
                            content: ""
                        }
                    }
                },
                sm: {
                    css: {
                        color: "var(color:--grayscale-a11)",
                        p: {
                            marginTop: "0.25rem"
                        },
                        "tbody td[rowspan]:first-child, tfoot td[rowspan]:first-child": {
                            paddingRight: em(12, 12)
                        },
                        "tbody td[rowspan]:first-child + td, tfoot td[rowspan]:first-child + td": {
                            paddingLeft: 0
                        }
                    }
                }
            }
        }
    },
    plugins: [typography, require("@tailwindcss/container-queries")],
    future: {
        hoverOnlyWhenSupported: true
    }
};

export default config;
