"use client";

import { Building2, Plus } from "lucide-react";
import { useState } from "react";

import { CreateOrganizationModal } from "@/components/auth/CreateOrganizationModal";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface CreateMenuItemProps {
    accessToken: string;
}

export function CreateMenuItem({ accessToken }: CreateMenuItemProps) {
    const [showOrgModal, setShowOrgModal] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="w-fit justify-start px-0 text-left hover:px-2 has-[>svg]:px-0 hover:has-[>svg]:px-2 md:w-8 md:justify-center"
                    >
                        <Plus className="h-[1.2rem] w-[1.2rem]" />
                        <span className="sr-only">Create new</span>
                        <span className="block md:hidden">Create</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={8}>
                    <DropdownMenuItem onClick={() => setShowOrgModal(true)}>
                        <Building2 className="h-[1.2rem] w-[1.2rem]" />
                        Organization
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <CreateOrganizationModal accessToken={accessToken} open={showOrgModal} onOpenChange={setShowOrgModal} />
        </>
    );
}
