import type { Meta, StoryObj } from "@storybook/react";

import { ExternalHoverLink } from "./ExternalHoverLink";

const meta: Meta<typeof ExternalHoverLink> = {
    title: "UI/ExternalHoverLink",
    component: ExternalHoverLink,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { href: "https://buildwithfern.com" }
};

export const WithDisplayHref: Story = {
    args: {
        href: "https://buildwithfern.com/learn/docs/getting-started/quickstart",
        displayHref: "buildwithfern.com/learn/docs"
    }
};

export const LongUrl: Story = {
    args: {
        href: "https://buildwithfern.com/learn/docs/getting-started/quickstart?utm_source=dashboard&utm_medium=referral&utm_campaign=plant-api"
    },
    decorators: [
        (Story) => (
            <div className="w-64">
                <Story />
            </div>
        )
    ]
};
