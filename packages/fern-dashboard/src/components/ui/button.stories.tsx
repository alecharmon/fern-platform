import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
    title: "UI/Button",
    component: Button,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: { type: "select" },
            options: [
                "default",
                "destructive",
                "destructiveOutline",
                "outline",
                "secondary",
                "ghost",
                "link",
                "linkUnderlined"
            ]
        },
        size: {
            control: { type: "select" },
            options: ["default", "xs", "sm", "lg", "icon", "iconSm"]
        },
        loading: { control: { type: "boolean" } },
        disabled: { control: { type: "boolean" } }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { children: "Create plant" }
};

export const Outline: Story = {
    args: { variant: "outline", children: "View plants" }
};

export const Secondary: Story = {
    args: { variant: "secondary", children: "Edit plant" }
};

export const Destructive: Story = {
    args: { variant: "destructive", children: "Delete plant" }
};

export const DestructiveOutline: Story = {
    args: { variant: "destructiveOutline", children: "Remove plant" }
};

export const Ghost: Story = {
    args: { variant: "ghost", children: "Cancel" }
};

export const Link: Story = {
    args: { variant: "link", children: "Learn more" }
};

export const LinkUnderlined: Story = {
    args: { variant: "linkUnderlined", children: "View documentation" }
};

export const Small: Story = {
    args: { size: "sm", children: "Small button" }
};

export const ExtraSmall: Story = {
    args: { size: "xs", children: "Tiny" }
};

export const Large: Story = {
    args: { size: "lg", children: "Large button" }
};

export const WithIcon: Story = {
    args: { children: "Add plant" },
    render: (args) => (
        <Button {...args}>
            <Plus />
            Add plant
        </Button>
    )
};

export const IconOnly: Story = {
    args: { size: "icon", "aria-label": "Add" },
    render: (args) => (
        <Button {...args}>
            <Plus />
        </Button>
    )
};

export const Loading: Story = {
    args: { loading: true, children: "Saving..." }
};

export const Disabled: Story = {
    args: { disabled: true, children: "Disabled" }
};
