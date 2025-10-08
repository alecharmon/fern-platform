"use client";

import { useRouter } from "@bprogress/next/app";
import { ChevronDown, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Auth0Organization, Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { getOrgDisplayName } from "@/utils/getOrgDisplayName";
import { addRecentOrg, getRecentOrgs } from "@/utils/recentOrgs";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";
import { OrgLogo } from "./org-logo/OrgLogo";

export const OrgSwitcherClient = ({
    organizations,
    currentOrgName
}: {
    organizations: Auth0Organization[];
    currentOrgName?: Auth0OrgName;
}) => {
    const orgName = useOrgNameFromPathname();
    const [localOrgName, setLocalOrgName] = useState(currentOrgName);
    const [searchTerm, setSearchTerm] = useState("");
    const [recentOrgNames, setRecentOrgNames] = useState<Auth0OrgName[]>([]);

    useEffect(() => {
        setLocalOrgName(orgName);
    }, [orgName]);

    // Load recent orgs from localStorage on mount
    useEffect(() => {
        setRecentOrgNames(getRecentOrgs());
    }, []);

    const pathname = usePathnameWithoutOrgName();
    const router = useRouter();

    // Organize organizations: recent first, then the rest
    const organizedOrganizations = useMemo(() => {
        const recentOrgs = organizations.filter((org) => recentOrgNames.includes(org.name));
        const otherOrgs = organizations.filter((org) => !recentOrgNames.includes(org.name));

        // Sort recent orgs by their order in recentOrgNames
        const sortedRecentOrgs = recentOrgs.sort((a, b) => {
            return recentOrgNames.indexOf(a.name) - recentOrgNames.indexOf(b.name);
        });

        return [...sortedRecentOrgs, ...otherOrgs];
    }, [organizations, recentOrgNames]);

    // Filter organizations by search term
    const filteredOrganizations = useMemo(() => {
        return organizedOrganizations.filter((org) => {
            const displayName = getOrgDisplayName(org) ?? "";
            return displayName.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [organizedOrganizations, searchTerm]);

    const getPathnameForOrg = (newOrgName: Auth0OrgName) => {
        return `/${newOrgName}${getRedirectPathname(pathname)}`;
    };

    const onClickOrg = (newOrgName: Auth0OrgName) => {
        if (newOrgName !== orgName) {
            setLocalOrgName(newOrgName);
        }
        // Save to recent orgs
        addRecentOrg(newOrgName);
        setRecentOrgNames(getRecentOrgs());
    };

    const onSelectOrg = (newOrgName: Auth0OrgName) => {
        onClickOrg(newOrgName);
        router.push(getPathnameForOrg(newOrgName));
    };

    const onHoverOrg = (hoveredOrgName: Auth0OrgName) => {
        router.prefetch(getPathnameForOrg(hoveredOrgName));
    };

    const currentOrg = organizations.find((org) => org.name === localOrgName);

    return (
        <SearchableDropdown
            items={filteredOrganizations}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSelect={(org) => onSelectOrg(org.name)}
            searchPlaceholder="Search organizations..."
            emptyMessage="No organizations found"
            getItemKey={(org) => org.id}
            shouldShowSearch={organizations.length > 10}
            renderItem={(organization, onSelectFromDropdown, isHighlighted) => {
                const isRecent = recentOrgNames.includes(organization.name);
                const isCurrent = organization.name === localOrgName;
                return (
                    <Link
                        className={cn(
                            "flex w-full cursor-pointer items-center justify-between px-3 rounded py-1.5 text-left text-sm focus:outline-none",
                            searchTerm.length > 0 && isHighlighted ? "bg-gray-300" : "hover:bg-gray-300"
                        )}
                        href={getPathnameForOrg(organization.name)}
                        onMouseOver={() => {
                            onHoverOrg(organization.name);
                        }}
                        onClick={() => {
                            if (isCurrent) {
                                return;
                            }
                            onClickOrg(organization.name);
                            onSelectFromDropdown();
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <OrgLogo organization={organization} />
                            {getOrgDisplayName(organization)}
                        </div>
                        {isRecent && <Clock className="h-4 w-4 text-gray-600" />}
                    </Link>
                );
            }}
        >
            <Button
                variant="outline"
                className="shrink-0 justify-between !pl-2 md:min-w-[200px]"
                disabled={organizations.length === 0}
            >
                <div className="flex items-center gap-2">
                    {currentOrg && <OrgLogo organization={currentOrg} />}
                    {currentOrg ? getOrgDisplayName(currentOrg) : "Select Organization"}
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
        </SearchableDropdown>
    );
};

function getRedirectPathname(pathname: string) {
    if (!pathname || pathname === "/" || pathname.includes("get-started") || pathname.includes("/docs")) {
        return "/docs";
    }
    return pathname;
}
