import type { DocsLoader } from "@fern-api/docs-server/docs-loader";

import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "../cn";
import { FernLinkButton } from "../FernLinkButton";
import { FernLinkDropdown } from "../FernLinkDropdown";
import { FaIconServer } from "../fa-icon-server";
import type { NavbarLink, NavbarLink as NavbarLinkType } from "../types/navbar-link";
import { GitHubWidget } from "./GitHubWidget";
import { WithReturnTo } from "./WithReturnTo";

export async function NavbarLinks({ loader }: { loader: DocsLoader }) {
    const config = await loader.getConfig();

    const navbarLinks: NavbarLink[] = [];

    config.navbarLinks?.forEach((link) => {
        if (link.type === "github") {
            navbarLinks.push({
                type: "github",
                href: link.url,
                className: undefined,
                id: undefined
            });
        } else if (link.type === "dropdown") {
            navbarLinks.push({
                type: "dropdown",
                links: link.links.map((subLink) => ({
                    href: subLink.url,
                    text: subLink.text,
                    icon: subLink.icon,
                    rightIcon: subLink.rightIcon,
                    rounded: subLink.rounded,
                    className: undefined,
                    id: undefined,
                    returnToQueryParam: undefined
                })),
                text: link.text,
                icon: link.icon,
                rightIcon: link.rightIcon,
                rounded: link.rounded,
                className: undefined,
                id: undefined
            });
        } else {
            navbarLinks.push({
                type: link.type,
                href: link.url,
                text: link.text,
                icon: link.icon,
                rightIcon: link.rightIcon,
                rounded: link.rounded,
                className: undefined,
                id: undefined,
                returnToQueryParam: undefined
            });
        }
    });

    return (
        <>
            {navbarLinks.map((navbarLink, idx) => (
                <HeaderNavbarLink key={navbarLink.id ?? idx} navbarLink={navbarLink} />
            ))}
        </>
    );
}

const getGitHubRepo = (url: string): string | null => {
    return url.match(/^https:\/\/(www\.)?github\.com\/([\w-]+\/[\w-]+)\/?$/)?.[2] ?? null;
};

function HeaderNavbarLink({ navbarLink }: { navbarLink: NavbarLinkType }) {
    if (navbarLink.type === "github") {
        const repo = getGitHubRepo(navbarLink.href);
        return repo && <GitHubWidget repo={repo} className={navbarLink.className} id={navbarLink.id} />;
    }

    if (navbarLink.type === "dropdown") {
        return (
            <FernLinkDropdown
                options={navbarLink.links.map((link) => ({
                    type: "value",
                    label: link.text,
                    value: link.href,
                    href: link.href,
                    icon: link.icon && <FaIconServer icon={link.icon} />,
                    rightElement: link.rightIcon && <FaIconServer icon={link.rightIcon} />
                }))}
                side="bottom"
                align="start"
                triggerAsChild={true}
                className={cn("fern-button group cursor-pointer mr-2", navbarLink.className)}
            >
                <div
                    className={cn(
                        "fern-button minimal normal group flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
                    )}
                >
                    {navbarLink.icon && <FaIconServer icon={navbarLink.icon} />}
                    {navbarLink.text && <span className="fern-button-text">{navbarLink.text}</span>}
                    {navbarLink.rightIcon ? (
                        <FaIconServer icon={navbarLink.rightIcon} />
                    ) : (
                        <ChevronDown className="size-icon duration-200 group-data-[state=open]:rotate-180" />
                    )}
                </div>
            </FernLinkDropdown>
        );
    }

    const link = (
        <FernLinkButton
            id={navbarLink.id}
            className={cn("group cursor-pointer", navbarLink.className)}
            href={navbarLink.href}
            icon={navbarLink.icon && <FaIconServer icon={navbarLink.icon} />}
            intent={navbarLink.type === "primary" || navbarLink.type === "filled" ? "primary" : "none"}
            rightIcon={
                navbarLink.rightIcon === "arrow-right" ? (
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                ) : (
                    navbarLink.rightIcon && <FaIconServer icon={navbarLink.rightIcon} />
                )
            }
            variant={
                navbarLink.type === "primary"
                    ? "outlined"
                    : navbarLink.type === "secondary"
                      ? "minimal"
                      : navbarLink.type
            }
            rounded={navbarLink.rounded}
            scroll={true}
        >
            {navbarLink.text}
        </FernLinkButton>
    );

    if (navbarLink.returnToQueryParam) {
        return <WithReturnTo queryParam={navbarLink.returnToQueryParam}>{link}</WithReturnTo>;
    }

    return link;
}
