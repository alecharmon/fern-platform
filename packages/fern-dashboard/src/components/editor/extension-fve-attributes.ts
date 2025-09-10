import { Node } from "@tiptap/core";

export const FVEAttributesExtension = Node.create({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          "fve-data-id": {
            default: null,
            keepOnSplit: false,
            renderHTML: (attributes) => {
              return attributes;
            },
          },
          "fve-mdx-b64": {
            default: null,
            keepOnSplit: false,
            renderHTML: (attributes) => {
              return attributes;
            },
          },
        },
      },
    ];
  },
});
