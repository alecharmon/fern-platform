import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Dialog> = {
    title: "UI/Dialog",
    component: Dialog,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create plant</DialogTitle>
                    <DialogDescription>Add a new plant to your collection.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="plant-name">Name</Label>
                            <Input id="plant-name" placeholder="e.g. Monstera deliciosa" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="plant-species">Species</Label>
                            <Input id="plant-species" placeholder="e.g. Araceae" />
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button>Save plant</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};

export const Persistent: Story = {
    name: "Persistent (no close button)",
    render: () => (
        <Dialog defaultOpen>
            <DialogContent persistent>
                <DialogHeader>
                    <DialogTitle>Confirm deletion</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete this plant? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button variant="destructive">Delete plant</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};

export const OpenByDefault: Story = {
    name: "Open by default",
    render: () => (
        <Dialog defaultOpen>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Welcome to the Plant API</DialogTitle>
                    <DialogDescription>Get started by creating your first plant endpoint.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <p className="text-sm text-muted-foreground">
                        Use POST /plants to create a new plant entry in your garden database.
                    </p>
                </DialogBody>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button>Get started</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};
