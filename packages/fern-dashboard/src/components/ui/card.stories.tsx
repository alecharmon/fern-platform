import type { Meta, StoryObj } from "@storybook/react";

import Card from "./card";

const meta: Meta<typeof Card> = {
    title: "UI/Card",
    component: Card,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: (
            <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold">Fern Plant API</h3>
                <p className="text-sm text-gray-600">A RESTful API for managing your plant collection.</p>
            </div>
        )
    }
};

export const WithCustomStyle: Story = {
    args: {
        className: "max-w-sm",
        children: (
            <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold">Endpoints</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>POST /plants</li>
                    <li>GET /plants/:plantId</li>
                    <li>PUT /plants/:plantId</li>
                    <li>DELETE /plants/:plantId</li>
                </ul>
            </div>
        )
    }
};
