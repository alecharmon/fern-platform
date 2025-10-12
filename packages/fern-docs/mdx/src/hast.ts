export type * from "hast";
export type { MdxjsEsmHast as MdxjsEsm } from "mdast-util-mdxjs-esm";
export type { MdxJsxElementHast as MdxJsxElement } from "./declarations";

declare module "hast" {
    interface ElementData {
        visited?: boolean;
        meta?: string | null;
        metastring?: string;
    }
}
