export function createCustomElementNode(mdxContent: string) {
    return {
        type: "custom-element-v2",
        // These data attributes help the client to handle the custom element
        attrs: {
            "fve-data-id": Math.random().toString().substring(2, 14),
            "fve-mdx-b64": Buffer.from(mdxContent, "utf-8").toString("base64"),
            "fve-newly-created": true
        },
        children: []
    };
}
