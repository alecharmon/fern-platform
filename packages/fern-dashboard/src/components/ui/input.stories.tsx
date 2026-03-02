import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";

const meta: Meta<typeof Input> = {
    title: "UI/Input",
    component: Input,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        type: {
            control: { type: "select" },
            options: ["text", "password", "email", "number", "search", "url"]
        },
        disabled: { control: { type: "boolean" } }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { placeholder: "Enter plant name..." }
};

export const WithValue: Story = {
    args: { value: "Monstera deliciosa", readOnly: true }
};

export const Password: Story = {
    args: { type: "password", placeholder: "Enter API key..." }
};

export const Number: Story = {
    args: { type: "number", placeholder: "Quantity..." }
};

export const Disabled: Story = {
    args: { placeholder: "Disabled input", disabled: true }
};

export const Invalid: Story = {
    args: { placeholder: "Invalid input", "aria-invalid": true }
};
