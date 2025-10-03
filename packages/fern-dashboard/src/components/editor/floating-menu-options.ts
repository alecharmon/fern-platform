import { Editor } from "@tiptap/react";
import {
    ChevronDown,
    ChevronsDown,
    Clapperboard,
    Code2,
    CodeXml,
    Folder,
    Grid2X2,
    Image,
    List,
    ListOrderedIcon,
    Megaphone,
    MousePointerClick,
    Square
} from "lucide-react";

import { EMPTY_ACCORDION_CONTENT, EMPTY_ACCORDION_GROUP_CONTENT } from "@/docs/mdx/components/accordion";
import { EMPTY_BUTTON_CONTENT } from "@/docs/mdx/components/button";
import { EMPTY_CALLOUT_CONTENT } from "@/docs/mdx/components/callout/Callout";
import { EMPTY_CARD_CONTENT, EMPTY_CARD_GROUP_CONTENT } from "@/docs/mdx/components/card/CardGroup";
import { EMPTY_PARAM_FIELD_CONTENT } from "@/docs/mdx/components/parameters/ParamField";
import { EMPTY_ENDPOINT_REQUEST_SNIPPET } from "@/docs/mdx/components/snippets/EndpointRequestSnippet";
import { EMPTY_ENDPOINT_RESPONSE_SNIPPET } from "@/docs/mdx/components/snippets/EndpointResponseSnippet";
import { EMPTY_ENDPOINT_SCHEMA_SNIPPET } from "@/docs/mdx/components/snippets/EndpointSchemaSnippet";
import { EMPTY_STEPS_CONTENT } from "@/docs/mdx/components/steps";
import { EMPTY_TABS_CONTENT } from "@/docs/mdx/components/tabs/Tabs";
import { EMPTY_EMBED_CONTENT } from "@/editor/components/Embed";

import { SuggestionItem } from "../tiptap-ui-utils/suggestion-menu";
import { createCustomElementNode } from "./extension-custom-element/create-custom-element-node";

const handleCustomNodeInsert = (editor: Editor, content: string) => {
    editor.chain().focus().insertContent(createCustomElementNode(content)).run();
};

export const slashMenuItems: (SuggestionItem & { aliases?: string[] })[] = [
    // Basic formatting items
    {
        title: "Code Block",
        subtext: "Add a code block",
        aliases: ["code", "code block"],
        badge: Code2,
        group: "Style",
        keywords: ["code", "code block"],
        onSelect: ({ editor }) => {
            editor.chain().focus().setCodeBlock().insertContent("console.log('Hello world!');").run();
        }
    },

    // Media items
    {
        title: "Image",
        subtext: "Add an image",
        aliases: ["image", "img", "picture"],
        badge: Image,
        group: "Media",
        keywords: ["image", "img", "picture", "media"],
        onSelect: ({ editor }) => {
            editor.chain().focus().setMediaUploadNode().run();
        }
    },
    {
        title: "Video",
        subtext: "Add a video",
        aliases: ["video", "embed", "iframe"],
        badge: Clapperboard,
        group: "Media",
        keywords: ["video", "embed", "iframe", "media"],
        onSelect: ({ editor }) => {
            editor.chain().focus().setMediaUploadNode().run();
        }
    },

    // Component items
    {
        title: "Accordion",
        subtext: "Add an accordion",
        aliases: ["accordion"],
        badge: ChevronDown,
        group: "Components",
        keywords: ["accordion"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_ACCORDION_CONTENT);
        }
    },
    {
        title: "Accordion Group",
        subtext: "Add an accordion group",
        aliases: ["accordion", "accordion group"],
        badge: ChevronsDown,
        group: "Components",
        keywords: ["accordion", "accordion group", "accordiongroup"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_ACCORDION_GROUP_CONTENT);
        }
    },
    {
        title: "Callout",
        subtext: "Add a callout",
        aliases: ["callout", "tip", "note", "warning", "error", "success"],
        badge: Megaphone,
        group: "Components",
        keywords: ["callout", "tip", "note", "warning", "error", "success"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_CALLOUT_CONTENT);
        }
    },
    {
        title: "Card",
        subtext: "Add a card",
        aliases: ["card"],
        badge: Square,
        group: "Components",
        keywords: ["card"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_CARD_CONTENT);
        }
    },
    {
        title: "Card Group",
        subtext: "Add a card group",
        aliases: ["card", "card group"],
        badge: Grid2X2,
        group: "Components",
        keywords: ["card", "card group", "cardgroup"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_CARD_GROUP_CONTENT);
        }
    },
    {
        title: "Parameter Field",
        subtext: "Add a parameter field",
        aliases: ["parameter", "parameter field"],
        badge: List,
        group: "Components",
        keywords: ["parameter", "parameter field"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_PARAM_FIELD_CONTENT);
        }
    },
    {
        title: "Steps",
        subtext: "Add step-by-step instructions",
        aliases: ["steps", "step", "step group"],
        badge: ListOrderedIcon,
        group: "Components",
        keywords: ["steps", "step", "step group"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_STEPS_CONTENT);
        }
    },
    {
        title: "Tabs",
        subtext: "Add a tab group",
        aliases: ["tabs", "tab", "option"],
        badge: Folder,
        group: "Components",
        keywords: ["tabs", "tab", "option"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_TABS_CONTENT);
        }
    },
    {
        title: "Button",
        subtext: "Add a button",
        aliases: ["button"],
        badge: MousePointerClick,
        group: "Components",
        keywords: ["button"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_BUTTON_CONTENT);
        }
    },
    {
        title: "Embed",
        subtext: "Embed external content",
        aliases: ["embed", "iframe", "external", "media"],
        badge: CodeXml,
        group: "Components",
        keywords: ["embed", "iframe", "external", "media"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_EMBED_CONTENT);
        }
    },
    {
        title: "Endpoint Request Snippet",
        subtext: "Show a code sample for an API request",
        aliases: ["endpoint", "request", "api", "code", "snippet"],
        badge: CodeXml,
        group: "Components",
        keywords: ["endpoint", "request", "api", "code", "snippet"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_ENDPOINT_REQUEST_SNIPPET);
        }
    },
    {
        title: "Endpoint Response Snippet",
        subtext: "Show a code sample for an API response",
        aliases: ["endpoint", "response", "api", "code", "snippet"],
        badge: CodeXml,
        group: "Components",
        keywords: ["endpoint", "response", "api", "code", "snippet"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_ENDPOINT_RESPONSE_SNIPPET);
        }
    },
    {
        title: "Endpoint Schema Snippet",
        subtext: "Show the schema for an API endpoint",
        aliases: ["endpoint", "schema", "api", "definition", "type"],
        badge: CodeXml,
        group: "Components",
        keywords: ["endpoint", "schema", "api", "definition", "type"],
        onSelect: ({ editor }) => {
            handleCustomNodeInsert(editor, EMPTY_ENDPOINT_SCHEMA_SNIPPET);
        }
    }
];
