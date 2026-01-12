/**
 * Navigation utilities for library docs integration.
 */

import type { FernRegistry } from "../../api/generated/index.js";

/**
 * Find all SidebarRootNodes in a navigation tree and append a section to each.
 */
export function appendSectionToSidebarRoots(
    root: FernRegistry.navigation.v1.RootNode,
    sectionNode: FernRegistry.navigation.v1.SectionNode
): void {
    const rootChild = root.child;

    if (rootChild.type === "unversioned") {
        appendToVersionChild(rootChild.child, sectionNode);
    } else if (rootChild.type === "versioned") {
        // Handle versioned docs - append to each version
        for (const version of rootChild.children) {
            appendToVersionChild(version.child, sectionNode);
        }
    } else if (rootChild.type === "productgroup") {
        // Handle product group - append to each product
        for (const product of rootChild.children) {
            if (product.type === "product") {
                const productChild = product.child;
                if (productChild.type === "versioned") {
                    for (const version of productChild.children) {
                        appendToVersionChild(version.child, sectionNode);
                    }
                } else if (productChild.type === "unversioned") {
                    appendToVersionChild(productChild.child, sectionNode);
                }
            }
        }
    }
}

/**
 * Append a section to a VersionChild (TabbedNode | SidebarRootNode | VariantedNode).
 */
function appendToVersionChild(
    child: FernRegistry.navigation.v1.VersionChild,
    sectionNode: FernRegistry.navigation.v1.SectionNode
): void {
    if (child.type === "sidebarRoot") {
        // Direct sidebar root - append section
        child.children.push(sectionNode);
    } else if (child.type === "tabbed") {
        // Tabbed layout - append to each tab's sidebar
        for (const tab of child.children) {
            if (tab.type === "tab" && tab.child.type === "sidebarRoot") {
                tab.child.children.push(sectionNode);
            }
        }
    }
    // Note: varianted layout is not yet supported for library docs injection
}
