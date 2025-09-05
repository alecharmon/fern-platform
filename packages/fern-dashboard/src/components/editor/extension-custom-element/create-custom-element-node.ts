import { createHash } from "crypto";

export function createCustomElementNode(tagName: string, mdxContent: string) {
  return {
    type: "custom-element-v2",
    // These data attributes help the client to handle the custom element
    attrs: {
      "fve-data-hash": createHash("sha256")
        .update(`${tagName}:${mdxContent}`)
        .digest("hex"),
      "fve-data-name": tagName,
      "fve-mdx-content": mdxContent,
      "fve-unsupported": "true",
    },
    children: [],
  };
}
