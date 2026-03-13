import type { Meta, StoryObj } from "@storybook/react";

import { OrgAlert } from "./OrgAlert";

const meta: Meta<typeof OrgAlert> = {
    title: "Components/OrgAlert",
    component: OrgAlert,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: { type: "select" },
            options: ["warning", "danger"]
        },
        onAction: { action: "clicked" }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const TrialEnding: Story = {
    args: {
        variant: "warning",
        message: "Team trial ends in 3 days",
        actionLabel: "Add payment"
    }
};

export const TrialEnded: Story = {
    args: {
        variant: "danger",
        message: "Team trial ended",
        actionLabel: "Add payment"
    }
};

export const AiServicesPaused: Story = {
    args: {
        variant: "danger",
        message: "AI services are paused",
        actionLabel: "Add credits"
    }
};

export const PaymentFailed: Story = {
    args: {
        variant: "danger",
        message: "Recent payment has failed",
        actionLabel: "Update payment"
    }
};
