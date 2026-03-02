import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Tooltip } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
    title: "UI/Tooltip",
    component: Tooltip,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <TooltipPrimitive.Provider>
                <Story />
            </TooltipPrimitive.Provider>
        )
    ]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        content: "Create a new plant entry",
        children: <Button variant="outline">Hover me</Button>
    }
};

export const Top: Story = {
    args: {
        content: "Tooltip on top",
        side: "top",
        children: <Button variant="outline">Top</Button>
    }
};

export const Bottom: Story = {
    args: {
        content: "Tooltip on bottom",
        side: "bottom",
        children: <Button variant="outline">Bottom</Button>
    }
};

export const Left: Story = {
    args: {
        content: "Tooltip on left",
        side: "left",
        children: <Button variant="outline">Left</Button>
    }
};

export const Right: Story = {
    args: {
        content: "Tooltip on right",
        side: "right",
        children: <Button variant="outline">Right</Button>
    }
};

export const LongContent: Story = {
    args: {
        content:
            "This plant requires bright indirect light and should be watered every 7-10 days during the growing season.",
        children: <Button variant="outline">Hover for plant care tips</Button>
    }
};

export const EmptyContent: Story = {
    name: "No tooltip (empty content)",
    args: {
        content: undefined,
        children: <Button variant="outline">No tooltip</Button>
    }
};
