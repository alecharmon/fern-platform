import type { Meta, StoryObj } from "@storybook/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
    title: "UI/Tabs",
    component: Tabs,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Tabs defaultValue="overview" className="w-96">
            <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
                <p className="text-sm text-muted-foreground">
                    The Plant API provides RESTful endpoints for managing your plant collection.
                </p>
            </TabsContent>
            <TabsContent value="endpoints">
                <ul className="text-sm text-muted-foreground space-y-1">
                    <li>POST /plants — Create a plant</li>
                    <li>GET /plants/:plantId — Get a plant</li>
                    <li>DELETE /plants/:plantId — Remove a plant</li>
                </ul>
            </TabsContent>
            <TabsContent value="settings">
                <p className="text-sm text-muted-foreground">
                    Configure rate limits and authentication for your plant API.
                </p>
            </TabsContent>
        </Tabs>
    )
};

export const ManyTabs: Story = {
    render: () => (
        <Tabs defaultValue="tab1" className="w-96">
            <TabsList>
                <TabsTrigger value="tab1">Plants</TabsTrigger>
                <TabsTrigger value="tab2">Gardens</TabsTrigger>
                <TabsTrigger value="tab3">Watering</TabsTrigger>
                <TabsTrigger value="tab4">Sunlight</TabsTrigger>
                <TabsTrigger value="tab5">Soil</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
                <p className="text-sm text-muted-foreground">Manage your plant inventory.</p>
            </TabsContent>
            <TabsContent value="tab2">
                <p className="text-sm text-muted-foreground">Organize plants into gardens.</p>
            </TabsContent>
            <TabsContent value="tab3">
                <p className="text-sm text-muted-foreground">Set watering schedules.</p>
            </TabsContent>
            <TabsContent value="tab4">
                <p className="text-sm text-muted-foreground">Track sunlight requirements.</p>
            </TabsContent>
            <TabsContent value="tab5">
                <p className="text-sm text-muted-foreground">Monitor soil conditions.</p>
            </TabsContent>
        </Tabs>
    )
};
