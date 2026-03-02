import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
    title: "UI/Skeleton",
    component: Skeleton,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { className: "h-4 w-48" }
};

export const Circle: Story = {
    args: { className: "size-10 rounded-full" }
};

export const Card: Story = {
    render: () => (
        <div className="flex flex-col gap-3 w-64">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
        </div>
    )
};

export const TextLines: Story = {
    render: () => (
        <div className="flex flex-col gap-2 w-80">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
        </div>
    )
};
