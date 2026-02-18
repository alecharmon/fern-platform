import type { TailwindConfig } from "@react-email/tailwind";

/**
 * Tailwind theme config for email templates.
 * Passed to the <Tailwind> component's `config` prop.
 */
export const tailwindConfig: TailwindConfig = {
    theme: {
        extend: {
            colors: {
                "fern-green": "#028700",
                "email-text": "#333333",
                "email-muted": "#71717a",
                "email-border": "#e4e4e7"
            },
            fontFamily: {
                sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"]
            }
        }
    }
};
