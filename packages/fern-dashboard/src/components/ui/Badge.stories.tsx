import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
    title: "UI/Badge",
    component: Badge,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: { type: "select" },
            options: ["info", "success", "warning"]
        }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
    args: { variant: "info", children: "Info badge" }
};

export const Success: Story = {
    args: { variant: "success", children: "Success badge" }
};

export const Warning: Story = {
    args: { variant: "warning", children: "Warning badge" }
};
