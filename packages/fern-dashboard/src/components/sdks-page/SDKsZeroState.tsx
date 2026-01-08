import type { Auth0User } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { CALENDLY_URL } from "../onboarding/constants";
import { SDKsZeroStateImage } from "./SDKsZeroStateImage";

export declare namespace SDKsZeroState {
    export interface Props {
        user: Auth0User;
    }
}

export async function SDKsZeroState({ user }: SDKsZeroState.Props) {
    let welcomeString = "Welcome";
    const firstName = getFirstName(user);
    if (firstName != null) {
        welcomeString += ", " + firstName;
    }

    const calendlyUrl = new URL(CALENDLY_URL);
    calendlyUrl.searchParams.set("email", user.email ?? "");
    calendlyUrl.searchParams.set("name", user.name ?? "");

    return (
        <div className="flex flex-1 flex-col">
            <div className="text-xl font-bold">{welcomeString}</div>
            <div className="mt-2 text-sm text-gray-900">SDKs that are designed by language experts.</div>
            <div className="mt-12">
                <div className="flex flex-col gap-12 justify-center items-center">
                    {/* Placeholder for an SDK-specific illustration if needed */}
                    <SDKsZeroStateImage />
                    <div className="flex flex-col gap-2 justify-center w-[300px]">
                        <Button variant="default" asChild>
                            <a
                                href="https://buildwithfern.com/learn/sdks/overview/quickstart"
                                target="_blank"
                                rel="noopener"
                            >
                                View SDK Quickstart
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a href={calendlyUrl.toString()} target="_blank" rel="noopener">
                                Book a call
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getFirstName(user: Auth0User) {
    if (user.name != null) {
        return user.name.split(" ")[0];
    }
    return undefined;
}
