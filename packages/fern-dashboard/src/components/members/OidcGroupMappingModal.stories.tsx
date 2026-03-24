import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";
import { type OidcGroupMappingFormData, OidcGroupMappingModal } from "./OidcGroupMappingModal";
import type { Resource } from "./RoleSelection";

const PUBLIC_DOCS: Resource[] = [
    { id: "docs-public", label: "docs.acme.com" },
    { id: "docs-api", label: "api-reference.acme.com" },
    { id: "docs-guides", label: "guides.acme.com" }
];

const INTERNAL_DOCS: Resource[] = [
    { id: "docs-internal", label: "internal.acme.com" },
    { id: "docs-runbooks", label: "runbooks.acme.com" }
];

const PARTNER_DOCS: Resource[] = [
    { id: "docs-partner", label: "partners.acme.com" },
    { id: "docs-sandbox", label: "sandbox.acme.com" },
    { id: "docs-staging", label: "staging.acme.com" },
    { id: "docs-public", label: "docs.acme.com" }
];

const MANY_RESOURCES: Resource[] = [
    { id: "docs-main", label: "docs.acme.com" },
    { id: "docs-api", label: "api-reference.acme.com" },
    { id: "docs-guides", label: "guides.acme.com" },
    { id: "docs-internal", label: "internal.acme.com" },
    { id: "docs-runbooks", label: "runbooks.acme.com" },
    { id: "docs-partners", label: "partners.acme.com" },
    { id: "docs-sandbox", label: "sandbox.acme.com" },
    { id: "docs-staging", label: "staging.acme.com" },
    { id: "docs-legacy", label: "legacy.acme.com" },
    { id: "docs-blog", label: "blog.acme.com" },
    { id: "docs-changelog", label: "changelog.acme.com" },
    { id: "docs-status", label: "status.acme.com" }
];

const SAMPLE_GROUP_NAMES = [
    "engineering",
    "design",
    "product",
    "marketing",
    "sales",
    "support",
    "platform-team",
    "contractor-external"
];

function StatefulWrapper({
    resources,
    existingGroupNames = [],
    isLoadingResources,
    isSaving,
    onSave
}: {
    resources: Resource[];
    existingGroupNames?: string[];
    isLoadingResources?: boolean;
    isSaving?: boolean;
    onSave: (mapping: OidcGroupMappingFormData) => void;
}) {
    const [open, setOpen] = useState(true);

    return (
        <OidcGroupMappingModal
            open={open}
            onOpenChange={setOpen}
            onSave={onSave}
            resources={resources}
            existingGroupNames={existingGroupNames}
            isLoadingResources={isLoadingResources}
            isSaving={isSaving}
        />
    );
}

const meta: Meta<typeof OidcGroupMappingModal> = {
    title: "Members/OidcGroupMappingModal",
    component: OidcGroupMappingModal,
    parameters: { layout: "centered" },
    tags: ["autodocs"],
    args: {
        onSave: fn(),
        onOpenChange: fn()
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <StatefulWrapper
            resources={PUBLIC_DOCS}
            existingGroupNames={SAMPLE_GROUP_NAMES}
            onSave={fn().mockName("onSave")}
        />
    )
};

export const NoExistingGroups: Story = {
    name: "No existing groups (create only)",
    render: () => <StatefulWrapper resources={[]} existingGroupNames={[]} onSave={fn().mockName("onSave")} />
};

export const LoadingResources: Story = {
    name: "Loading resources",
    render: () => (
        <StatefulWrapper
            resources={[]}
            existingGroupNames={SAMPLE_GROUP_NAMES}
            isLoadingResources={true}
            onSave={fn().mockName("onSave")}
        />
    )
};

export const Saving: Story = {
    name: "Saving state",
    render: () => (
        <StatefulWrapper
            resources={INTERNAL_DOCS}
            existingGroupNames={SAMPLE_GROUP_NAMES}
            isSaving={true}
            onSave={fn().mockName("onSave")}
        />
    )
};

export const ManyResources: Story = {
    name: "Many resources (scrollable)",
    render: () => (
        <StatefulWrapper
            resources={MANY_RESOURCES}
            existingGroupNames={SAMPLE_GROUP_NAMES}
            onSave={fn().mockName("onSave")}
        />
    )
};

export const PartnerAccess: Story = {
    name: "Partner access resources",
    render: () => (
        <StatefulWrapper
            resources={PARTNER_DOCS}
            existingGroupNames={SAMPLE_GROUP_NAMES}
            onSave={fn().mockName("onSave")}
        />
    )
};

export const NoResources: Story = {
    name: "No resources",
    render: () => (
        <StatefulWrapper resources={[]} existingGroupNames={SAMPLE_GROUP_NAMES} onSave={fn().mockName("onSave")} />
    )
};
