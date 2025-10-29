export interface DefaultNavbarLink extends BaseNavbarLink {
    type: "filled" | "outlined" | "minimal" | "primary" | "secondary";
}

export interface BaseNavbarLink {
    href: string;
    text: string | undefined;
    icon: string | undefined;
    rightIcon: string | undefined;
    rounded: boolean | undefined;
    className: string | undefined;
    id: string | undefined;
    returnToQueryParam: string | undefined;
}

export interface GithubNavbarLink {
    type: "github";
    href: string;
    className: string | undefined;
    id: string | undefined;
}

export interface DropdownNavbarLink extends BaseNavbarLink {
    type: "dropdown";
    links: BaseNavbarLink[];
}

export type NavbarLink = DefaultNavbarLink | GithubNavbarLink | DropdownNavbarLink;
