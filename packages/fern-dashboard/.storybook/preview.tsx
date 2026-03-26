import type { Preview } from "@storybook/react";

import "../src/app/globals.css";
import "./fonts.css";

const preview: Preview = {
    tags: ["autodocs"],
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        },
        layout: "centered",
        docs: {
            toc: true
        }
    },
    globalTypes: {
        theme: {
            description: "Toggle light/dark mode",
            toolbar: {
                title: "Theme",
                icon: "sun",
                items: [
                    { value: "light", icon: "sun", title: "Light" },
                    { value: "dark", icon: "moon", title: "Dark" }
                ],
                dynamicTitle: true
            }
        }
    },
    initialGlobals: {
        theme: "light"
    },
    decorators: [
        (Story, context) => {
            const theme = context.globals.theme ?? "light";
            return (
                <div className={`font-sans antialiased ${theme === "dark" ? "dark" : ""}`}>
                    <div className="bg-background text-foreground p-8">
                        <Story />
                    </div>
                </div>
            );
        }
    ]
};

export default preview;
