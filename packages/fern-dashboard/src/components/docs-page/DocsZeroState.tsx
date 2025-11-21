import type { User } from "@auth0/nextjs-auth0/types";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsZeroStateButton } from "./DocsZeroStateButton";
import { DocsZeroStateImage } from "./DocsZeroStateImage";
import { DocsZeroStateRequestOrgAccess } from "./DocsZeroStateRequestOrgAccess";
import { DocsZeroStateTracker } from "./DocsZeroStateTracker";

export declare namespace DocsZeroState {
    export interface Props {
        user: User;
        orgName?: Auth0OrgName;
    }
}

export async function DocsZeroState({ user, orgName }: DocsZeroState.Props) {
    let welcomeString = "Welcome";
    const firstName = getFirstName(user);
    if (firstName != null) {
        welcomeString += ", " + firstName;
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <DocsZeroStateTracker hasOrgName={orgName != null} userEmail={user.email ?? ""} />
            <div className="text-xl font-bold">{welcomeString}</div>
            <div className="mt-2 text-sm text-gray-900">Delight your developers with gorgeous Docs.</div>
            <div className="mt-12">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex w-full flex-col gap-3 max-w-md">
                        {orgName ? (
                            <DocsZeroStateButton orgName={orgName} />
                        ) : (
                            <>
                                <DocsZeroStateRequestOrgAccess user={user} />
                                <div className="flex items-center gap-3">
                                    <div className="h-px flex-1 bg-gray-300" />
                                    <span className="text-xs text-gray-900">OR</span>
                                    <div className="h-px flex-1 bg-gray-300" />
                                </div>
                                <DocsZeroStateButton orgName={undefined} />
                            </>
                        )}
                    </div>
                    <div className="w-full relative h-1">
                        <div className="w-full max-w-[1024px] min-[440px]:min-w-[512px] absolute left-1/2 -translate-x-1/2">
                            <DocsZeroStateImage />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getFirstName(user: User) {
    if (user.given_name != null) {
        return user.given_name;
    }
    if (user.name != null) {
        return user.name.split(" ")[0];
    }
    return undefined;
}
