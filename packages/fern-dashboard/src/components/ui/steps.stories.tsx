import type { Meta, StoryObj } from "@storybook/react";

import { Step, Steps } from "./steps";

const meta: Meta<typeof Steps> = {
    title: "UI/Steps",
    component: Steps,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Steps>
            <Step number={1} title="Create your plant API definition">
                <p className="text-sm text-gray-600">
                    Define your plant endpoints using the Fern Definition Language or OpenAPI.
                </p>
            </Step>
            <Step number={2} title="Configure generators">
                <p className="text-sm text-gray-600">Add SDK generators for TypeScript, Python, and other languages.</p>
            </Step>
            <Step number={3} title="Generate SDKs">
                <p className="text-sm text-gray-600">Run fern generate to produce client libraries for your API.</p>
            </Step>
        </Steps>
    )
};

export const WithCompletedSteps: Story = {
    render: () => (
        <Steps>
            <Step number={1} title="Install Fern CLI" completed>
                <p className="text-sm text-gray-600">Run npm install -g fern-api to get started.</p>
            </Step>
            <Step number={2} title="Initialize project" completed>
                <p className="text-sm text-gray-600">Run fern init to create your project structure.</p>
            </Step>
            <Step number={3} title="Add plant endpoints">
                <p className="text-sm text-gray-600">Define POST /plants, GET /plants/:plantId, and other endpoints.</p>
            </Step>
        </Steps>
    )
};
