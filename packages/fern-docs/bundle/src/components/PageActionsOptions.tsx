import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { DocsV1Read } from "@fern-api/fdr-sdk";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { t } from "@fern-docs/i18n";
import { Copy, ExternalLink } from "lucide-react";
import type { ParamValue } from "next/dist/server/request/params";
import type { ReactNode } from "react";
import { isSelfHosted } from "@/server/isSelfHosted";

import { ClaudeIcon, CursorIcon, MarkdownIcon, OpenAIIcon, SparklesIconHollow, TextIcon } from "./PageActionsAssets";
import { processIconString } from "./util/processIconString";

export const Separator = (): FernDropdown.SeparatorOption => {
    return {
        type: "separator"
    } as FernDropdown.SeparatorOption;
};

export const CopyPageOption = ({
    lang,
    defaultOption
}: {
    lang: string;
    defaultOption?: boolean;
}): FernDropdown.ValueOption => {
    return {
        type: "value",
        value: "copy-page",
        label: t(lang).documentation.copyPage,
        helperText: t(lang).documentation.copyPageAsMarkdown,
        icon: <Copy className="size-icon" height={24} width={24} />,
        default: defaultOption
    } as FernDropdown.ValueOption;
};

export const ViewAsMarkdownOption = ({
    domain,
    slug,
    lang,
    defaultOption
}: {
    domain: string;
    slug: string;
    lang: string;
    defaultOption?: boolean;
}): FernDropdown.ValueOption => {
    return {
        type: "value",
        value: "view-as-markdown",
        label: t(lang).buttons.viewAsMarkdown,
        helperText: t(lang).documentation.viewThisPageAsPlainText,
        icon: <MarkdownIcon />,
        href: `https://${domain}/${slug}.md`,
        rightElement: <ExternalLink className="size-icon" />,
        default: defaultOption
    } as FernDropdown.ValueOption;
};

export type LLM_OPTIONS = "ChatGPT" | "Claude";

export const LLM_URLS: Record<LLM_OPTIONS, [string, ReactNode]> = {
    ChatGPT: ["https://chat.openai.com/?hint=search&q=", <OpenAIIcon key="openai-logo" />],
    Claude: ["https://claude.ai/new?q=", <ClaudeIcon key="claude-logo" />]
};

export const OpenAISearchOption = ({
    lang,
    defaultOption
}: {
    lang: string;
    defaultOption?: boolean;
}): FernDropdown.ValueOption => {
    return {
        type: "value",
        value: "open-ai-search",
        label: t(lang).search.askAQuestion,
        helperText: t(lang).search.chatWithAIAssistant,
        icon: <SparklesIconHollow />,
        default: defaultOption
    } as FernDropdown.ValueOption;
};

export const OpenLLMSTxtOption = ({
    lang,
    defaultOption
}: {
    lang: string;
    defaultOption?: boolean;
}): FernDropdown.ValueOption => {
    return {
        type: "value",
        value: "open-llms-txt",
        label: t(lang).ai.llm,
        helperText: t(lang).buttons.readLlmsTxt,
        icon: <TextIcon key="llms-txt-logo" />,
        href: `/llms.txt`,
        default: defaultOption
    } as FernDropdown.ValueOption;
};

// this function is unused, because claude/chatgpt can't read llms.txt
// if this changes, can bring this back.
export const OpenWithLLM = ({
    domain,
    slug,
    llm,
    lang,
    defaultOption
}: {
    domain: ParamValue;
    slug: ParamValue;
    llm: LLM_OPTIONS;
    lang: string;
    defaultOption?: boolean;
}): FernDropdown.ValueOption => {
    const resolveParam = (param: ParamValue): string => {
        if (typeof param === "string") {
            return decodeURIComponent(param);
        } else if (Array.isArray(param)) {
            return decodeURIComponent(param.join("/"));
        } else {
            return "";
        }
    };

    const decodedDomain = resolveParam(domain);
    const decodedSlug = resolveParam(slug);

    const prompt = `Read ${decodedDomain}/${decodedSlug}.md so I can ask questions about it.`;

    const label = llm === "ChatGPT" ? t(lang).documentation.openInChatGPT : t(lang).documentation.openInClaude;

    return {
        type: "value",
        value: `open-${llm.toLowerCase()}`,
        label: label,
        helperText: t(lang).search.askQuestionsAboutThisPage,
        icon: LLM_URLS[llm][1],
        href: `${LLM_URLS[llm][0]}${encodeURIComponent(prompt)}`,
        rightElement: <ExternalLink className="size-icon" />,
        default: defaultOption
    } as FernDropdown.ValueOption;
};

export const OpenWithCursor = async ({
    domain,
    lang,
    defaultOption
}: {
    domain: ParamValue;
    lang: string;
    defaultOption?: boolean;
}): Promise<FernDropdown.ValueOption> => {
    const resolveParam = (param: ParamValue): string => {
        if (typeof param === "string") {
            return decodeURIComponent(param);
        } else if (Array.isArray(param)) {
            return decodeURIComponent(param.join("/"));
        } else {
            return "";
        }
    };

    const decodedDomain = resolveParam(domain);

    const mcpServerConfig = {
        name: decodedDomain,
        url: `https://${decodedDomain}/_mcp/server`
    };
    const mcpServerConfigBase64 = btoa(JSON.stringify(mcpServerConfig));

    return {
        type: "value",
        value: "open-cursor",
        label: t(lang).buttons.connectToCursor,
        helperText: t(lang).documentation.installMcpServerOnCursor,
        icon: <CursorIcon />,
        // Example MCP server config for Cursor install link
        // See: https://modelcontextprotocol.org/docs/context/mcp
        href: `cursor://anysphere.cursor-deeplink/mcp/install?name=${mcpServerConfig.name}&config=${mcpServerConfigBase64}`,
        rightElement: <ExternalLink className="size-icon" />,
        default: defaultOption
    } as FernDropdown.ValueOption;
};

export interface CustomPageActionConfig {
    title: string;
    subtitle?: string;
    url: string;
    icon?: string;
    default?: boolean;
}

const resolveParam = (param: ParamValue): string => {
    if (typeof param === "string") {
        return decodeURIComponent(param);
    } else if (Array.isArray(param)) {
        return decodeURIComponent(param.join("/"));
    } else {
        return "";
    }
};

const isUrl = (str: string): boolean => {
    return str.startsWith("http://") || str.startsWith("https://");
};

const renderCustomActionIcon = (icon?: string, files?: Record<string, FileData>): ReactNode | undefined => {
    if (!icon) {
        return undefined;
    }
    if (isUrl(icon)) {
        return <img src={icon} alt="" className="size-icon" width={16} height={16} />;
    }
    return processIconString({
        icon,
        files,
        className: "size-icon",
        renderFaIcon: (faIcon) => <FaIcon icon={faIcon} className="size-icon" />
    });
};

export const CustomPageActionOption = ({
    customAction,
    slug,
    files
}: {
    customAction: CustomPageActionConfig;
    slug: ParamValue;
    files?: Record<string, FileData>;
}): FernDropdown.ValueOption => {
    const resolvedSlug = resolveParam(slug);
    const resolvedUrl = customAction.url.replaceAll("{slug}", resolvedSlug);

    return {
        type: "value",
        value: `custom-${customAction.title.toLowerCase().replace(/\s+/g, "-")}`,
        label: customAction.title,
        helperText: customAction.subtitle,
        icon: renderCustomActionIcon(customAction.icon, files),
        href: resolvedUrl,
        rightElement: <ExternalLink className="size-icon" />,
        default: customAction.default
    } as FernDropdown.ValueOption;
};

// don't add separators here, since we may reorder and add options in PageActionsDropdown.tsx
export async function constructPageOptions({
    pageActionConfig,
    domain,
    slug,
    lang,
    files
}: {
    pageActionConfig: Omit<DocsV1Read.DocsConfig, "navigation" | "root">;
    domain: ParamValue;
    slug: ParamValue;
    lang: string;
    files?: Record<string, FileData>;
}): Promise<FernDropdown.PageActionOption[] | undefined> {
    const options: FernDropdown.PageActionOption[] = [];
    if (pageActionConfig.pageActions?.options?.copyPage !== false) {
        options.push(CopyPageOption({ lang, defaultOption: pageActionConfig.pageActions?.default === "copyPage" }));
    }

    if (slug?.toString() && domain?.toString() && pageActionConfig.pageActions?.options?.viewAsMarkdown !== false) {
        options.push(
            ViewAsMarkdownOption({
                domain: domain?.toString(),
                slug: slug?.toString(),
                lang,
                defaultOption: pageActionConfig.pageActions?.default === "viewAsMarkdown"
            })
        );
    }

    const customActions = pageActionConfig.pageActions?.options?.custom;
    if (customActions && slug) {
        for (const customAction of customActions) {
            options.push(
                CustomPageActionOption({
                    customAction: {
                        title: customAction.title,
                        subtitle: customAction.subtitle,
                        url: customAction.url,
                        icon: customAction.icon,
                        default: customAction.default
                    },
                    slug,
                    files
                })
            );
        }
    }

    if (isSelfHosted()) {
        return options;
    }

    if (pageActionConfig.pageActions?.options?.claude !== false) {
        options.push(
            OpenWithLLM({
                domain,
                slug,
                llm: "Claude",
                lang,
                defaultOption: pageActionConfig.pageActions?.default === "claude"
            })
        );
    }

    if (pageActionConfig.pageActions?.options?.openAi !== false) {
        options.push(
            OpenWithLLM({
                domain,
                slug,
                llm: "ChatGPT",
                lang,
                defaultOption: pageActionConfig.pageActions?.default === "openAi"
            })
        );
    }

    if (pageActionConfig.pageActions?.options?.cursor !== false) {
        options.push(
            await OpenWithCursor({ domain, lang, defaultOption: pageActionConfig.pageActions?.default === "cursor" })
        );
    }

    if (options.length === 0) {
        return undefined;
    }

    return options;
}
