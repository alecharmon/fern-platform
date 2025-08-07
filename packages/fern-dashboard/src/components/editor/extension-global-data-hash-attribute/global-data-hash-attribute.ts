import { Node, mergeAttributes } from "@tiptap/core";

// IMPORTANT: This extension depends on the UniqueID extension to set the id attribute on the Tiptap node
// UniqueID should be included before this extension in the Tiptap extensions array or be configured with a higher priority

export const GlobalDataHashAttribute = Node.create({
  addStorage() {
    return {
      hashToId: {},
    };
  },

  addGlobalAttributes() {
    return [
      {
        // From GlobalDataHashAttribute.configure({ types: ... })
        types: this.options.types,
        attributes: {
          "data-hash": {
            default: null,
            keepOnSplit: false,
            renderHTML: (attributes) => {
              // The UniqueId extension sets the id attribute on the Tiptap node
              if (attributes.id && attributes["data-hash"]) {
                // hashToId[hash] should always be set to the first detected ID for a given hash i.e. the state from initial render
                const storedId = this.storage.hashToId[attributes["data-hash"]];
                this.storage.hashToId[attributes["data-hash"]] =
                  storedId ?? attributes.id;
              }
              return mergeAttributes(attributes, {
                // Do not set data-hash if the ID does not match the stored ID
                "data-hash":
                  attributes["data-hash"] &&
                  attributes.id ===
                    this.storage.hashToId[attributes["data-hash"]]
                    ? attributes["data-hash"]
                    : null,
              });
            },
          },
        },
      },
    ];
  },
});
