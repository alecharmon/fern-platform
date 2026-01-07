import LinkIcon from "@heroicons/react/24/outline/LinkIcon";
import PaperAirplaneIcon from "@heroicons/react/24/outline/PaperAirplaneIcon";
import UserPlusIcon from "@heroicons/react/24/outline/UserPlusIcon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { type AddUserDirectlyResult, addUserDirectlyToOrg } from "@/app/actions/addUserDirectlyToOrg";
import { createInviteLink } from "@/app/actions/createInviteLink";
import { inviteUserToOrg } from "@/app/actions/inviteUserToOrg";
import type { Auth0Organization } from "@/app/services/auth0/types";
import { type inferQueryData, ReactQueryKey } from "@/state/queryKeys";
import { getOrgDisplayName } from "@/utils/getOrgDisplayName";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { Button } from "../ui/button";
import { CopyableText } from "../ui/CopyableText";
import { DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { RoleSelectionGroup, type UserRole } from "./RoleSelection";

export declare namespace InviteUserDialogContent {
    export interface Props {
        org: Auth0Organization | undefined;
        close: () => void;
        initialEmail?: string;
        initialTab?: "link" | "email";
        isFernAdmin?: boolean;
        isEnforcePermissionsEnabled?: boolean;
    }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteUserDialogContent({
    org,
    close,
    initialEmail,
    initialTab,
    isFernAdmin,
    isEnforcePermissionsEnabled = false
}: InviteUserDialogContent.Props) {
    const orgName = useOrgNameFromPathname();
    const queryKey = ReactQueryKey.orgInvitations(orgName);
    const membersQueryKey = ReactQueryKey.orgMembers(orgName);

    const [email, setEmail] = useState(initialEmail ?? "");
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"link" | "email">(initialTab ?? "link");
    const [isClosing, setIsClosing] = useState(false);
    // Default to admin when permissions aren't enforced, otherwise viewer
    const [selectedRole, setSelectedRole] = useState<UserRole>(isEnforcePermissionsEnabled ? "viewer" : "admin");
    const [cliEnabled, setCliEnabled] = useState(false);

    const isValidEmail = useMemo(() => EMAIL_REGEX.test(email), [email]);

    const queryClient = useQueryClient();
    const getRoles = () => {
        const roles: ("admin" | "editor" | "viewer" | "cli")[] = [selectedRole];
        if (cliEnabled) {
            roles.push("cli");
        }
        return roles;
    };

    const inviteUser = useMutation({
        mutationFn: () => inviteUserToOrg({ orgName, inviteeEmail: email, roles: getRoles() }),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey });

            const previousInvitations = queryClient.getQueryData<inferQueryData<typeof queryKey>>(queryKey);

            queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, (oldInvitations = []) => [
                { id: undefined, inviteeEmail: email },
                ...oldInvitations
            ]);

            return { previousInvitations };
        },
        onError: async (error, _variables, context) => {
            console.error(`Failed to invite ${email}`, error);
            toast.error(`Failed to invite ${email}`);
            if (context?.previousInvitations != null) {
                queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, context.previousInvitations);
            }

            // only invalidate on error. if we invalidate on success, we can wipe
            // out other optimsitic writes (if the user is removing multiple members)
            await queryClient.invalidateQueries({ queryKey });
        },
        onSuccess: ({ invitationId }) => {
            queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, (oldInvitations) =>
                oldInvitations?.map((invitation) =>
                    invitation.id == null && invitation.inviteeEmail === email
                        ? { ...invitation, id: invitationId }
                        : invitation
                )
            );
            toast.success(`Invitation sent to ${email}`);
        }
    });

    const createLink = useMutation({
        mutationFn: () => createInviteLink({ orgName }),
        onSuccess: ({ inviteUrl }) => {
            setInviteLink(inviteUrl);
            toast.success("Invite link created successfully");
        },
        onError: (error) => {
            console.error("Failed to create invite link", error);
            toast.error("Failed to create invite link");
        }
    });

    const addUserDirectly = useMutation<AddUserDirectlyResult>({
        mutationFn: () => addUserDirectlyToOrg({ email, orgName, roles: getRoles() }),
        onSuccess: async (result) => {
            if (!result.ok) {
                toast.error(result.message);
                return;
            }
            toast.success(`${result.userEmail} added to organization`);
            await queryClient.invalidateQueries({ queryKey: membersQueryKey });
            setIsClosing(true);
            close();
        },
        onError: (error) => {
            console.error(`Failed to add user directly`, error);
            toast.error("Something went wrong while adding the user. Please try again.");
        }
    });

    const isInviting = inviteUser.isPending || isClosing;
    const isCreatingLink = createLink.isPending || isClosing;
    const isAddingDirectly = addUserDirectly.isPending || isClosing;

    return (
        <>
            <DialogHeader>
                <DialogTitle>Invite members to {getOrgDisplayName(org) ?? "organization"}</DialogTitle>
                <DialogDescription>
                    Choose how you&apos;d like to invite new members to your organization.
                </DialogDescription>
            </DialogHeader>
            <DialogBody>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "link" | "email")}>
                    <TabsList>
                        <TabsTrigger value="link">One-time link</TabsTrigger>
                        <TabsTrigger value="email">Email</TabsTrigger>
                    </TabsList>
                    <TabsContent value="link">
                        <div className="space-y-4">
                            <p className="text-muted-foreground text-sm">
                                Create a one-time use invite link that can be shared with anyone.
                            </p>
                            {!inviteLink ? (
                                <Button
                                    onClick={() => createLink.mutate()}
                                    disabled={isCreatingLink}
                                    className="w-full"
                                >
                                    {isCreatingLink ? (
                                        <>
                                            Generating link...
                                            <Loader2 className="size-4 animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            Generate Invite Link
                                            <LinkIcon className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <div className="space-y-3">
                                    <CopyableText text={inviteLink} successMessage="Invite link copied to clipboard!" />
                                    <p className="text-muted-foreground text-xs">
                                        This link can be used once and expires in 24 hours.
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                    <TabsContent value="email">
                        <div className="space-y-4">
                            <p className="text-muted-foreground text-sm">
                                Send a user an email to invite them to your organization.
                            </p>
                            <div>
                                <div className="text-gray-1100 mb-2 text-sm">Email</div>
                                <Input
                                    autoFocus={true}
                                    placeholder="marty_mcfly@buildwithfern.com"
                                    disabled={isInviting || isAddingDirectly}
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.currentTarget.value.trim());
                                    }}
                                />
                                <p className="text-muted-foreground mt-2 text-xs">
                                    The invited user&apos;s account email must match the invitation email address.
                                </p>
                            </div>
                            {isEnforcePermissionsEnabled && (
                                <RoleSelectionGroup
                                    role={selectedRole}
                                    onRoleChange={setSelectedRole}
                                    cliEnabled={cliEnabled}
                                    onCliEnabledChange={setCliEnabled}
                                    disabled={isInviting || isAddingDirectly}
                                    id="invite-user"
                                />
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogBody>
            <DialogFooter className="flex-col gap-2 min-[480px]:flex-row">
                <Button
                    variant="outline"
                    onClick={close}
                    disabled={isInviting || isCreatingLink || isAddingDirectly}
                    className="w-full min-[480px]:w-auto"
                >
                    {activeTab === "link" ? "Close" : "Cancel"}
                </Button>

                {activeTab === "email" && (
                    <div className="flex w-full flex-col gap-2 min-[480px]:w-auto min-[480px]:flex-row">
                        {isFernAdmin && (
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (!isValidEmail || isAddingDirectly) {
                                        toast.error("Invalid email or already adding user");
                                        return;
                                    }
                                    addUserDirectly.mutate();
                                }}
                                disabled={isAddingDirectly || isInviting}
                                className="w-full min-[480px]:w-auto"
                            >
                                {isAddingDirectly ? (
                                    <>
                                        Adding...
                                        <Loader2 className="size-4 animate-spin" />
                                    </>
                                ) : (
                                    <>
                                        <UserPlusIcon className="h-4 w-4" />
                                        Add directly (admin)
                                    </>
                                )}
                            </Button>
                        )}
                        <Button
                            onClick={() => {
                                if (!isValidEmail || isInviting) {
                                    toast.error("Invalid email or already invited user");
                                    return;
                                }
                                inviteUser.mutate();
                                setIsClosing(true);
                                close();
                            }}
                            disabled={isInviting || isAddingDirectly}
                            className="w-full min-[480px]:w-auto"
                        >
                            Send invitation
                            <PaperAirplaneIcon />
                        </Button>
                    </div>
                )}
            </DialogFooter>
        </>
    );
}
