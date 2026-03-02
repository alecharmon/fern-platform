import type { Meta, StoryObj } from "@storybook/react";

import { TextArea } from "./textarea";

const meta: Meta<typeof TextArea> = {
    title: "UI/TextArea",
    component: TextArea,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        disabled: { control: { type: "boolean" } }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { placeholder: "Describe the plant species..." }
};

export const WithValue: Story = {
    args: {
        value: "The Monstera deliciosa is a species of flowering plant native to tropical forests. It is known for its large, glossy, heart-shaped leaves that develop distinctive holes as the plant matures.",
        readOnly: true
    }
};

export const Disabled: Story = {
    args: { placeholder: "Disabled textarea", disabled: true }
};

export const Invalid: Story = {
    args: { placeholder: "Required field", "aria-invalid": true }
};
