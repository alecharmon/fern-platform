import type { User } from "@auth0/nextjs-auth0/types";
import { DocsZeroStateButton } from "./DocsZeroStateButton";
import { DocsZeroStateImage } from "./DocsZeroStateImage";

export declare namespace DocsZeroState {
    export interface Props {
        user: User;
    }
}

export async function DocsZeroState({ user }: DocsZeroState.Props) {
    let welcomeString = "Welcome";
    const firstName = getFirstName(user);
    if (firstName != null) {
        welcomeString += ", " + firstName;
    }

    return (
        <div className="flex flex-1 flex-col">
            <div className="text-xl font-bold">{welcomeString}</div>
            <div className="mt-2 text-sm text-gray-900">Delight your developers with gorgeous Docs.</div>
            <div className="mt-12">
                <div className="flex flex-col gap-4">
                    <DocsZeroStateImage />
                    <div className="flex justify-center">
                        <DocsZeroStateButton />
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
