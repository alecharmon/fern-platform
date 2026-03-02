import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Label> = {
    title: "UI/Label",
    component: Label,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { children: "Plant name" }
};

export const WithInput: Story = {
    render: () => (
        <div className="flex flex-col gap-2">
            <Label htmlFor="plant-name">Plant name</Label>
            <Input id="plant-name" placeholder="e.g. Monstera deliciosa" />
        </div>
    )
};
