import type { DocsLoader } from "@fern-api/docs-server/docs-loader";

import { ArrowRight } from "lucide-react";
import React from "react";
import { cn } from "../cn";
import { FernLinkButton } from "../FernLinkButton";
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
