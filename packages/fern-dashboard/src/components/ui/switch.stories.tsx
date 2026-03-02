import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "./label";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
    title: "UI/Switch",
    component: Switch,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        disabled: { control: { type: "boolean" } }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
    args: { defaultChecked: true }
};

export const Disabled: Story = {
    args: { disabled: true }
};

export const DisabledChecked: Story = {
    args: { disabled: true, defaultChecked: true }
};

export const WithLabel: Story = {
    render: () => (
        <div className="flex items-center gap-2">
            <Switch id="auto-water" />
            <Label htmlFor="auto-water">Enable auto-watering</Label>
        </div>
    )
};
