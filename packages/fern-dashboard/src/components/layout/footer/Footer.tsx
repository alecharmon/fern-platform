import { ChevronDown } from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import { FernIcon } from "../../theme/FernIcon";
import { FooterExternalLink } from "./FooterExternalLink";
import { FooterText } from "./FooterText";

export function Footer() {
    return (
        <div className="flex flex-wrap items-center gap-6">
            <FernIcon className="w-4" />
            <FooterText>/</FooterText>
            <FooterExternalLink href="https://buildwithfern.com">Home</FooterExternalLink>
            <FooterExternalLink href="https://buildwithfern.com/learn">Docs</FooterExternalLink>
            <FooterExternalLink href="https://buildwithfern.com/careers">Careers</FooterExternalLink>
            <FooterExternalLink href="https://buildwithfern.com/book-a-demo/demo">Contact</FooterExternalLink>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <FooterText hoverable>
                        <div className="flex cursor-pointer items-center gap-1">
                            <div>Legal</div>
                            <ChevronDown className="mt-0.5 size-3" />
                        </div>
                    </FooterText>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                        <a
                            href="https://buildwithfern.com/privacy-policy"
                            target="_blank"
                            className="cursor-pointer"
                            rel="noopener"
                        >
                            Privacy Policy
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href="https://buildwithfern.com/terms-of-service"
                            target="_blank"
                            className="cursor-pointer"
                            rel="noopener"
                        >
                            Terms of Service
                        </a>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
