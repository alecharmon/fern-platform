import { Icon } from "../icon/Icon";

export type FloatingMenuAction =
  | "toggleHeading1"
  | "toggleHeading2"
  | "toggleHeading3"
  | "toggleBulletList"
  | "toggleOrderedList"
  | "toggleQuote"
  | "setLink"
  | "plainText"
  | "toggleImage";

export interface MenuItem {
  title: string;
  iconProps: Icon.Props;
  action: FloatingMenuAction;
  keywords: string[];
}

export const menuItems: MenuItem[] = [
  {
    title: "Text",
    iconProps: { variant: "Type" },
    action: "plainText",
    keywords: ["text", "paragraph", "p"],
  },
  {
    title: "Heading 1",
    iconProps: { variant: "Heading1" },
    action: "toggleHeading1",
    keywords: ["heading", "h1", "header", "title"],
  },
  {
    title: "Heading 2",
    iconProps: { variant: "Heading2" },
    action: "toggleHeading2",
    keywords: ["heading", "h2", "header", "subtitle"],
  },
  {
    title: "Heading 3",
    iconProps: { variant: "Heading3" },
    action: "toggleHeading3",
    keywords: ["heading", "h3", "header"],
  },
  {
    title: "Bulleted list",
    iconProps: { variant: "List" },
    action: "toggleBulletList",
    keywords: ["list", "bullet", "ul", "unordered"],
  },
  {
    title: "Numbered list",
    iconProps: { variant: "ListOrdered" },
    action: "toggleOrderedList",
    keywords: ["list", "number", "ol", "ordered"],
  },
  {
    title: "Quote",
    iconProps: { variant: "MessageSquareQuote" },
    action: "toggleQuote",
    keywords: ["quote", "blockquote", "citation"],
  },
  {
    title: "Image",
    iconProps: { variant: "Image" },
    action: "toggleImage",
    keywords: ["image", "img", "picture"],
  },
];
