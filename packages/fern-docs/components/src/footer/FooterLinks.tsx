import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import {
    BookOpen,
    Facebook,
    Github,
    Globe,
    Hash,
    Instagram,
    Linkedin,
    MessageCircle,
    Newspaper,
    Twitter,
    Youtube
} from "lucide-react";
import type React from "react";
import { cn } from "../cn";

const ICON_SIZE = 16;

function getFooterLinkIcon(type: string) {
    switch (type) {
        case "github":
            return <Github size={ICON_SIZE} strokeWidth={1.5} />;
        case "twitter":
        case "x":
            return <Twitter size={ICON_SIZE} strokeWidth={1.5} />;
        case "linkedin":
            return <Linkedin size={ICON_SIZE} strokeWidth={1.5} />;
        case "youtube":
            return <Youtube size={ICON_SIZE} strokeWidth={1.5} />;
        case "instagram":
            return <Instagram size={ICON_SIZE} strokeWidth={1.5} />;
        case "facebook":
            return <Facebook size={ICON_SIZE} strokeWidth={1.5} />;
        case "discord":
            return <MessageCircle size={ICON_SIZE} strokeWidth={1.5} />;
        case "slack":
            return <Hash size={ICON_SIZE} strokeWidth={1.5} />;
        case "hackernews":
            return <Newspaper size={ICON_SIZE} strokeWidth={1.5} />;
        case "medium":
            return <BookOpen size={ICON_SIZE} strokeWidth={1.5} />;
        case "website":
            return <Globe size={ICON_SIZE} strokeWidth={1.5} />;
        default:
            return <Globe size={ICON_SIZE} strokeWidth={1.5} />;
    }
}

function getFooterLinkLabel(type: string): string {
    switch (type) {
        case "github":
            return "GitHub";
        case "twitter":
            return "Twitter";
        case "x":
            return "X";
        case "linkedin":
            return "LinkedIn";
        case "youtube":
            return "YouTube";
        case "instagram":
            return "Instagram";
        case "facebook":
            return "Facebook";
        case "discord":
            return "Discord";
        case "slack":
            return "Slack";
        case "hackernews":
            return "Hacker News";
        case "medium":
            return "Medium";
        case "website":
            return "Website";
        default:
            return "Link";
    }
}

export async function FooterLinks({
    loader,
    className,
    customFooter
}: {
    loader: DocsLoader;
    className?: string;
    customFooter?: React.ReactNode;
}) {
    const config = await loader.getConfig();

    // If there's a custom footer component, render it instead of default footer links
    if (customFooter != null) {
        return (
            <div className={cn("flex flex-col items-center", className)}>
                <hr className="w-full border-t border-(color:--grayscale-a6) mb-8" />
                {customFooter}
            </div>
        );
    }

    const footerLinks = config.footerLinks ?? [];

    if (footerLinks.length === 0) {
        return null;
    }

    return (
        <div className={cn("flex flex-col items-center", className)}>
            <hr className="w-full border-t border-(color:--grayscale-a6) mb-8" />
            <div className="flex items-center justify-center gap-4">
                {footerLinks.map((link, idx) => (
                    <a
                        key={idx}
                        href={link.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Follow on ${getFooterLinkLabel(link.type)}`}
                        className="text-(color:--grayscale-a9) hover:text-(color:--grayscale-a11) transition-colors"
                    >
                        {getFooterLinkIcon(link.type)}
                    </a>
                ))}
            </div>
        </div>
    );
}
