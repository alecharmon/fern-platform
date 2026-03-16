import type { Meta, StoryObj } from "@storybook/react";

import { FullScreenLoader } from "./full-screen-loader";

const meta: Meta<typeof FullScreenLoader> = {
    title: "UI/FullScreenLoader",
    component: FullScreenLoader,
    parameters: { layout: "fullscreen" },
    tags: ["autodocs"],
    argTypes: {
        message: { control: { type: "text" } }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMessage: Story = {
    args: { message: "Setting up your workspace..." }
};
