import type { Meta, StoryObj } from "@storybook/react";

import { TeleprompterTextOnHover } from "./TeleprompterTextOnHover";

const meta: Meta<typeof TeleprompterTextOnHover> = {
    title: "UI/TeleprompterTextOnHover",
    component: TeleprompterTextOnHover,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        duration: { control: { type: "number", min: 0.5, max: 10, step: 0.5 } },
        disabled: { control: { type: "boolean" } }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: "This is a very long text that will scroll when you hover over it because it overflows its container",
        containerClassName: "w-48"
    }
};

export const ShortText: Story = {
    name: "Short text (no scroll)",
    args: {
        children: "Short text",
        containerClassName: "w-48"
    }
};

export const FastScroll: Story = {
    args: {
        children: "This text scrolls quickly when hovered because the duration is set to a low value",
        containerClassName: "w-48",
        duration: 0.5
    }
};

export const SlowScroll: Story = {
    args: {
        children: "This text scrolls slowly when hovered because the duration is set to a high value",
        containerClassName: "w-48",
        duration: 5
    }
};

export const Disabled: Story = {
    args: {
        children: "This text will not scroll even when hovered because it is disabled",
        containerClassName: "w-48",
        disabled: true
    }
};
