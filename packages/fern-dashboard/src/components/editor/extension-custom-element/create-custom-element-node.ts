export function createCustomElementNode(tagName: string, mdxContent: string) {
  return {
    type: "custom-element-v2",
    // These data attributes help the client to handle the custom element
    attrs: {
      "fve-data-id": Math.random().toString().substring(2, 14),
      "fve-data-name": tagName,
      "fve-mdx-b64": Buffer.from(mdxContent, "utf-8").toString("base64"),
      "fve-unsupported": "true",
    },
    children: [],
  };
}
