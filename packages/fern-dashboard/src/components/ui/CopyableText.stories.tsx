import type { Meta, StoryObj } from "@storybook/react";
import { Toaster } from "sonner";

import { CopyableText } from "./CopyableText";

function CopyableTextStory(props: React.ComponentProps<typeof CopyableText>) {
    return (
        <>
            <Toaster />
            <CopyableText {...props} />
        </>
    );
}

const meta: Meta<typeof CopyableText> = {
    title: "UI/CopyableText",
    component: CopyableTextStory,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: { type: "select" },
            options: ["default", "innerCopy"]
        }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        text: "npm install @fern-api/plantstore-sdk",
        successMessage: "Install command copied!"
    }
};

export const InnerCopy: Story = {
    args: {
        text: "sk-plant-api-key-1234567890",
        variant: "innerCopy",
        successMessage: "API key copied!"
    }
};

export const LongText: Story = {
    args: {
        text: "https://api.buildwithfern.com/v1/plants/monstera-deliciosa?include=care_instructions&format=detailed"
    },
    decorators: [
        (Story) => (
            <div className="w-96">
                <Story />
            </div>
        )
    ]
};
