"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChevronDown } from "lucide-react";

import { Auth0OrgName, Auth0Organization } from "@/app/services/auth0/types";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { Button } from "@/components/ui/button";
import { getOrgDisplayName } from "@/utils/getOrgDisplayName";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";

import { OrgLogo } from "./org-logo/OrgLogo";

export const OrgSwitcherClient = ({
  organizations,
  currentOrgName,
}: {
  organizations: Auth0Organization[];
  currentOrgName: Auth0OrgName;
}) => {
  const orgName = useOrgNameFromPathname();
  const [localOrgName, setLocalOrgName] = useState(currentOrgName);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setLocalOrgName(orgName);
  }, [orgName]);

  const pathname = usePathnameWithoutOrgName();
  const router = useRouter();

  // Filter organizations by search term
  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const displayName = getOrgDisplayName(org) ?? "";
      return displayName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [organizations, searchTerm]);

  const getPathnameForOrg = (newOrgName: Auth0OrgName) => {
    return `/${newOrgName}${getRedirectPathname(pathname)}`;
  };

  const onClickOrg = (newOrgName: Auth0OrgName) => {
    if (newOrgName !== orgName) {
      setLocalOrgName(newOrgName);
      router.push(getPathnameForOrg(newOrgName));
    }
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
      onSelect={(org) => onClickOrg(org.name)}
      searchPlaceholder="Search organizations..."
      emptyMessage="No organizations found"
      getItemKey={(org) => org.id}
      shouldShowSearch={organizations.length > 10}
      renderItem={(organization, onSelect) => (
        <div
          className="flex w-full cursor-pointer justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          onClick={onSelect}
          onMouseOver={() => {
            onHoverOrg(organization.name);
          }}
        >
          <div className="flex items-center gap-2">
            <OrgLogo organization={organization} />
            {getOrgDisplayName(organization)}
          </div>
        </div>
      )}
    >
      <Button
        variant="outline"
        className="shrink-0 justify-between !pl-2 md:min-w-[200px]"
        disabled={organizations.length === 0}
      >
        <div className="flex items-center gap-2">
          {currentOrg && <OrgLogo organization={currentOrg} />}
          {currentOrg ? getOrgDisplayName(currentOrg) : "Organization"}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>
    </SearchableDropdown>
  );
};

function getRedirectPathname(pathname: string) {
  // if the current pathame is /docs/<domain>, just redirect to /docs
  if (pathname.startsWith("/docs/")) {
    return "/docs";
  }
  return pathname;
}
