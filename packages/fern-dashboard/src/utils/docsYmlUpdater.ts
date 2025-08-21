import yaml from "js-yaml";

export interface PageEntry {
  page: string;
  path?: string;
}

function isPageEntry(entry: unknown): entry is PageEntry {
  return (
    typeof entry === "object" &&
    entry != null &&
    "page" in entry &&
    typeof entry.page === "string" &&
    ("path" in entry ? typeof entry.path === "string" : true)
  );
}

export interface SectionEntry {
  section: string;
  contents: (PageEntry | SectionEntry)[];
}

function isSectionEntry(entry: unknown): entry is SectionEntry {
  return (
    typeof entry === "object" &&
    entry != null &&
    "section" in entry &&
    typeof entry.section === "string" &&
    "contents" in entry &&
    Array.isArray(entry.contents)
  );
}

export interface DocsConfig {
  navigation?: (PageEntry | SectionEntry)[];
  products?: unknown;
}

/**
 * Parses a YAML string into a JavaScript object
 */
export function parseYaml(yamlContent: string): DocsConfig {
  try {
    const result = yaml.load(yamlContent);
    if (typeof result !== "object" || result == null) {
      throw new Error("YAML content is not a valid object");
    }
    return result as DocsConfig;
  } catch (error) {
    console.error("Error parsing YAML:", error);
    throw new Error("Failed to parse YAML content");
  }
}

/**
 * Checks if a page already exists in the navigation structure
 */
export function pageExistsInNavigation(
  navigationContents: (PageEntry | SectionEntry)[],
  pagePath: string
): boolean {
  for (const item of navigationContents) {
    if (isSectionEntry(item)) {
      // Recursively check within sections
      if (pageExistsInNavigation(item.contents, pagePath)) {
        return true;
      }
    } else if (isPageEntry(item) && item.path === pagePath) {
      return true;
    }
  }
  return false;
}

/**
 * Converts a JavaScript object to a YAML string
 */
export function stringifyYaml(obj: DocsConfig): string {
  try {
    return yaml.dump(obj, {
      lineWidth: -1, // Don't wrap long lines
      quotingType: '"', // Use double quotes
      forceQuotes: false, // Only quote when necessary
      indent: 2,
    });
  } catch (error) {
    console.error("Error stringifying YAML:", error);
    throw new Error("Failed to stringify object to YAML");
  }
}

/**
 * Adds a new page to a section in the navigation structure (supports nested sections)
 */
export function addPageToSection(
  navigationContents: (PageEntry | SectionEntry)[],
  sectionTitle: string,
  pageEntry: PageEntry
): (PageEntry | SectionEntry)[] {
  const updatedContents = [...navigationContents];

  // First try to find the section at the top level
  const topLevelIndex = updatedContents.findIndex(
    (item) => isSectionEntry(item) && item.section === sectionTitle
  );

  if (topLevelIndex !== -1) {
    // Section found at top level, we know it's a SectionEntry
    const section = updatedContents[topLevelIndex] as SectionEntry;
    const updatedSection = {
      ...section,
      contents: [pageEntry, ...section.contents],
    };
    updatedContents[topLevelIndex] = updatedSection;
    return updatedContents;
  }

  // If not found at top level, search recursively through nested sections
  for (let i = 0; i < updatedContents.length; i++) {
    const item = updatedContents[i];

    if (isSectionEntry(item)) {
      // Try to find and update the target section within this section's contents
      const result = findAndUpdateSection(
        item.contents,
        sectionTitle,
        pageEntry
      );
      if (result.found) {
        updatedContents[i] = {
          ...item,
          contents: result.updatedContents,
        };
        return updatedContents;
      }
    }
  }

  throw new Error(`Section "${sectionTitle}" not found in navigation`);
}

/**
 * Helper function to find and update a section within nested contents
 */
function findAndUpdateSection(
  contents: (PageEntry | SectionEntry)[],
  sectionTitle: string,
  pageEntry: PageEntry
): { found: boolean; updatedContents: (PageEntry | SectionEntry)[] } {
  const updatedContents = [...contents];

  for (let i = 0; i < updatedContents.length; i++) {
    const item = updatedContents[i];

    if (isSectionEntry(item) && item.section === sectionTitle) {
      // Found the target section - add the page to its contents
      const section = item;
      updatedContents[i] = {
        ...section,
        contents: [pageEntry, ...section.contents],
      };
      return { found: true, updatedContents };
    }

    // If this is a section with contents, search recursively
    if (isSectionEntry(item)) {
      const recursiveResult = findAndUpdateSection(
        item.contents,
        sectionTitle,
        pageEntry
      );
      if (recursiveResult.found) {
        // Update the current item's contents with the updated nested contents
        updatedContents[i] = {
          ...item,
          contents: recursiveResult.updatedContents,
        };
        return { found: true, updatedContents };
      }
    }
  }

  return { found: false, updatedContents };
}

/**
 * Removes a page from a section in the navigation structure (supports nested sections)
 */
export function removePageFromSection(
  navigationContents: (PageEntry | SectionEntry)[],
  pagePath: string
): (PageEntry | SectionEntry)[] {
  return navigationContents
    .map((item): PageEntry | SectionEntry | null => {
      if (isSectionEntry(item)) {
        // This is a section, recursively remove from its contents
        const section = item;
        return {
          ...section,
          contents: removePageFromSection(section.contents, pagePath),
        };
      }
      // This is a top-level page, check if it matches the path to remove
      if (isPageEntry(item) && item.path === pagePath) {
        return null; // Mark for removal
      }
      return item;
    })
    .filter((item): item is PageEntry | SectionEntry => item != null); // Remove nulled items
}

/**
 * Updates docs.yml navigation to include a new page
 */
export function addPageToDocsYml(
  docsYmlContent: string,
  sectionTitle: string,
  pageEntry: PageEntry
): string {
  const docsConfig = parseYaml(docsYmlContent);

  // Handle different docs.yml structures
  if (docsConfig.products && Array.isArray(docsConfig.products)) {
    // Products-based structure - navigation is defined in separate product files
    // Return original content as client-side navigation handles page display
    return docsYmlContent;
  } else if (docsConfig.navigation && Array.isArray(docsConfig.navigation)) {
    // Direct navigation structure - update the navigation array
    const updatedNavigation = addPageToSection(
      docsConfig.navigation,
      sectionTitle,
      pageEntry
    );

    const updatedConfig = {
      ...docsConfig,
      navigation: updatedNavigation,
    };

    return stringifyYaml(updatedConfig);
  } else {
    throw new Error(
      "Invalid docs.yml: missing navigation array and no products structure found"
    );
  }
}

/**
 * Updates docs.yml navigation to remove a page
 */
export function removePageFromDocsYml(
  docsYmlContent: string,
  pagePath: string
): string {
  const docsConfig = parseYaml(docsYmlContent);

  // Handle different docs.yml structures
  if (docsConfig.products && Array.isArray(docsConfig.products)) {
    // Products-based structure - navigation is defined in separate product files
    // Return original content as client-side navigation handles page display
    return docsYmlContent;
  } else if (docsConfig.navigation && Array.isArray(docsConfig.navigation)) {
    // Direct navigation structure - remove from the navigation array
    const updatedNavigation = removePageFromSection(
      docsConfig.navigation,
      pagePath
    );

    const updatedConfig = {
      ...docsConfig,
      navigation: updatedNavigation,
    };

    return stringifyYaml(updatedConfig);
  } else {
    throw new Error(
      "Invalid docs.yml: missing navigation array and no products structure found"
    );
  }
}
