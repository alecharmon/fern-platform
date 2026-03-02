import type { Preview } from "@storybook/react";

import "../src/app/globals.css";

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        },
        layout: "centered"
    },
    decorators: [
        (Story) => (
            <div className="font-sans antialiased">
                <Story />
            </div>
        )
    ]
};

export default preview;
