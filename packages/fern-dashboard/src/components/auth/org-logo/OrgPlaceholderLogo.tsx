import { Auth0Organization } from "@/app/services/auth0/types";

export declare namespace OrgPlaceholderLogo {
    export interface Props {
        org: Auth0Organization;
    }
}

export function OrgPlaceholderLogo({ org }: OrgPlaceholderLogo.Props) {
    return (
        <div className="text-primary border-border flex flex-1 items-center justify-center rounded border bg-green-200 p-1 text-xl uppercase">
            {org.display_name[0]}
        </div>
    );
}
