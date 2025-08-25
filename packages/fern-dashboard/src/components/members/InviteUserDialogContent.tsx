import { useMemo, useState } from "react";

import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { inviteUserToOrg } from "@/app/actions/inviteUserToOrg";
import { Auth0Organization } from "@/app/services/auth0/types";
import { ReactQueryKey, inferQueryData } from "@/state/queryKeys";
import { getOrgDisplayName } from "@/utils/getOrgDisplayName";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { Button } from "../ui/button";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

export declare namespace InviteUserDialogContent {
  export interface Props {
    org: Auth0Organization | undefined;
    close: () => void;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteUserDialogContent({
  org,
  close,
}: InviteUserDialogContent.Props) {
  const orgName = useOrgNameFromPathname();
  const queryKey = ReactQueryKey.orgInvitations(orgName);

  const [email, setEmail] = useState("");

  const isValidEmail = useMemo(() => EMAIL_REGEX.test(email), [email]);

  const queryClient = useQueryClient();
  const inviteUser = useMutation({
    mutationFn: () => inviteUserToOrg({ orgName, inviteeEmail: email }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousInvitations =
        queryClient.getQueryData<inferQueryData<typeof queryKey>>(queryKey);

      queryClient.setQueryData<inferQueryData<typeof queryKey>>(
        queryKey,
        (oldInvitations = []) => [
          { id: undefined, inviteeEmail: email },
          ...oldInvitations,
        ]
      );

      return { previousInvitations };
    },
    onError: async (error, _variables, context) => {
      console.error(`Failed to invite ${email}`, error);
      toast.error(`Failed to invite ${email}`);
      if (context?.previousInvitations != null) {
        queryClient.setQueryData<inferQueryData<typeof queryKey>>(
          queryKey,
          context.previousInvitations
        );
      }

      // only invalidate on error. if we invalidate on success, we can wipe
      // out other optimsitic writes (if the user is removing multiple members)
      await queryClient.invalidateQueries({ queryKey });
    },
    onSuccess: ({ invitationId }) => {
      queryClient.setQueryData<inferQueryData<typeof queryKey>>(
        queryKey,
        (oldInvitations) =>
          oldInvitations?.map((invitation) =>
            invitation.id == null && invitation.inviteeEmail === email
              ? { ...invitation, id: invitationId }
              : invitation
          )
      );
    },
  });

  const isInviting = inviteUser.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Invite members to {getOrgDisplayName(org) ?? "organization"}
        </DialogTitle>
        <DialogDescription>
          The user will receive an email to accept the invitation.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="text-gray-1100 text-sm">Email</div>
        <Input
          placeholder="marty_mcfly@hillvalley.edu"
          disabled={isInviting}
          value={email}
          onChange={(e) => {
            setEmail(e.currentTarget.value.trim());
          }}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={close} disabled={isInviting}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (!isValidEmail || isInviting) {
              toast.error("Invalid email or already invited", {
                duration: Infinity,
              });
              return;
            }
            inviteUser.mutate();
            close();
          }}
        >
          Send invitation
          <PaperAirplaneIcon />
        </Button>
      </DialogFooter>
    </>
  );
}
