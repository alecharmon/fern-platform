"use client";

import { useRouter } from "@bprogress/next/app";
import { ChevronDown, Clock, Plus } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import type { Auth0Organization, Auth0OrgName } from "@/app/services/auth0/types";
import { CreateOrganizationModal } from "@/components/auth/CreateOrganizationModal";
import { Button } from "@/components/ui/button";
import { SearchableDropdown, type SearchableDropdownRef } from "@/components/ui/SearchableDropdown";
import { WrapWithKeyboardShortcut } from "@/components/ui/WrapWithKeyboardShortcut";
import { useOrganizations } from "@/state/useOrganizations";
import { getOrgDisplayName } from "@/utils/getOrgDisplayName";
import { addRecentOrg, getRecentOrgs } from "@/utils/recentOrgs";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";
import { OrgLogo } from "./org-logo/OrgLogo";

interface OrgSwitcherClientRef {
    openSwitcher: () => void;
}

const OrgSwitcherClientInternal = forwardRef<
    OrgSwitcherClientRef,
    {
        organizations: Auth0Organization[];
        currentOrgName?: Auth0OrgName;
        isFernAdmin: boolean;
        accessToken: string;
    }
>(({ organizations, currentOrgName, isFernAdmin, accessToken }, ref) => {
    const dropdownRef = useRef<SearchableDropdownRef>(null);

    useImperativeHandle(ref, () => ({
        openSwitcher: () => {
            dropdownRef.current?.open();
        }
    }));
    const orgName = useOrgNameFromPathname();
    const [localOrgName, setLocalOrgName] = useState(currentOrgName);
    const [searchTerm, setSearchTerm] = useState("");
    const [recentOrgNames, setRecentOrgNames] = useState<Auth0OrgName[]>([]);
    const [showOrgModal, setShowOrgModal] = useState(false);

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

    // Filter organizations by search term and add admin option if applicable
    const filteredOrganizationsWithAdmin = useMemo(() => {
        const filtered = organizedOrganizations.filter((org) => {
            const displayName = getOrgDisplayName(org) ?? "";
            return displayName.toLowerCase().includes(searchTerm.toLowerCase());
        });

        const trimmedSearch = searchTerm.trim();

        // If user is Fern admin, has a search term, and the search doesn't match any org name exactly, add admin option
        if (isFernAdmin && trimmedSearch.length > 0) {
            const hasExactMatch = filtered.some((org) => org.name.toLowerCase() === trimmedSearch.toLowerCase());
            if (!hasExactMatch) {
                // Create a pseudo-organization for the admin option
                const adminOption = {
                    id: `__admin_${trimmedSearch}`,
                    name: trimmedSearch as Auth0OrgName,
                    display_name: `Go to '${trimmedSearch}' →`,
                    __isAdminOption: true
                } as Auth0Organization & { __isAdminOption: boolean };

                return [...filtered, adminOption];
            }
        }

        return filtered;
    }, [organizedOrganizations, searchTerm, isFernAdmin]);

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

    const shouldShowSearch = organizations.length > 10;

    return (
        <>
            <SearchableDropdown
                ref={dropdownRef}
                items={filteredOrganizationsWithAdmin}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelect={(org) => onSelectOrg(org.name)}
                searchPlaceholder="Search organizations..."
                emptyMessage="No organizations found"
                getItemKey={(org) => org.id}
                shouldShowSearch={shouldShowSearch}
                searchRightContent={
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-[38px] w-[38px] shrink-0 p-0"
                        onClick={() => setShowOrgModal(true)}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Create organization</span>
                    </Button>
                }
                headerContent={
                    !shouldShowSearch ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="flex w-full items-center justify-start gap-2 px-2"
                            onClick={() => setShowOrgModal(true)}
                        >
                            <Plus className="h-4 w-4" />
                            <span>Create new org</span>
                        </Button>
                    ) : undefined
                }
                renderItem={(organization, onSelectFromDropdown, isHighlighted) => {
                    // Check if this is the admin option
                    const isAdminOption = "__isAdminOption" in organization && organization.__isAdminOption;

                    if (isAdminOption) {
                        return (
                            <button
                                type="button"
                                className={cn(
                                    "flex w-full cursor-pointer items-center justify-between px-3 rounded py-1.5 text-left text-sm focus:outline-none flex-wrap text-muted-foreground",
                                    isHighlighted ? "bg-gray-300" : "hover:bg-gray-300"
                                )}
                                onClick={() => {
                                    onSelectOrg(organization.name);
                                    onSelectFromDropdown();
                                }}
                            >
                                <div className="flex flex-1 items-center gap-2">
                                    Go to <code className="text-wrap max-w-[170px]">{organization.name}</code>
                                </div>
                                <div className="flex-shrink-0 justify-end">→</div>
                            </button>
                        );
                    }

                    // Regular organization
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
            <CreateOrganizationModal accessToken={accessToken} open={showOrgModal} onOpenChange={setShowOrgModal} />
        </>
    );
});

OrgSwitcherClientInternal.displayName = "OrgSwitcherClientInternal";

export const OrgSwitcherClient = ({
    organizations: initialOrganizations,
    currentOrgName,
    isFernAdmin,
    accessToken
}: {
    organizations: Auth0Organization[];
    currentOrgName?: Auth0OrgName;
    isFernAdmin: boolean;
    accessToken: string;
}) => {
    const orgSwitcherRef = useRef<OrgSwitcherClientRef>(null);

    // Use client-side organizations data if available, otherwise fall back to server-provided initial data
    const organizationsResult = useOrganizations();
    const organizations = organizationsResult.type === "loaded" ? organizationsResult.value : initialOrganizations;

    return (
        <WrapWithKeyboardShortcut
            shortcut="o"
            onShortcut={() => orgSwitcherRef.current?.openSwitcher()}
            disabled={organizations.length === 0}
        >
            <OrgSwitcherClientInternal
                ref={orgSwitcherRef}
                organizations={organizations}
                currentOrgName={currentOrgName}
                isFernAdmin={isFernAdmin}
                accessToken={accessToken}
            />
        </WrapWithKeyboardShortcut>
    );
};

function getRedirectPathname(pathname: string) {
    if (!pathname || pathname === "/" || pathname.includes("get-started") || pathname.includes("/docs")) {
        return "/docs";
    }
    return pathname;
}
