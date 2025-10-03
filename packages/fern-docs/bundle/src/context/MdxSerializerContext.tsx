import { MdxSerializer } from "@/server/mdx-serializer";

let serializeStore: MdxSerializer | undefined;

export const getMdxSerializer = () => serializeStore;

export const setMdxSerializer = (value: MdxSerializer) => {
    serializeStore = value;
};
