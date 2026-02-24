import type { GetOrganizations200ResponseOneOfInner } from "auth0";

const createBrandedStringCreator = <T>(value: string) => value as T;

export type Auth0OrgID = string & { __Auth0OrgID: void };
export const Auth0OrgID = createBrandedStringCreator<Auth0OrgID>;

export type Auth0OrgName = string & { __Auth0OrgName: void };
export const Auth0OrgName = createBrandedStringCreator<Auth0OrgName>;

export type Auth0UserID = string & { __Auth0UserID: void };
export const Auth0UserID = createBrandedStringCreator<Auth0UserID>;

export type Auth0RoleID = string & { __Auth0RoleID: void };
export const Auth0RoleID = createBrandedStringCreator<Auth0RoleID>;

// the auth0 typings are incorrect (missing some question marks)
export interface Auth0Organization extends Pick<GetOrganizations200ResponseOneOfInner, "display_name"> {
    id: Auth0OrgID;
    name: Auth0OrgName;
    branding?: Partial<GetOrganizations200ResponseOneOfInner["branding"]>;
    metadata?: GetOrganizations200ResponseOneOfInner["metadata"];
}

export interface Auth0User {
    sub: Auth0UserID;
    name?: string;
    email?: string;
    picture?: string;
}
