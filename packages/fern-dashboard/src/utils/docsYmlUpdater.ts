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
 * Adds a new page to a section in the navigation structure
 */
export function addPageToSection(
  navigationContents: (PageEntry | SectionEntry)[],
  sectionTitle: string,
  pageEntry: PageEntry
): (PageEntry | SectionEntry)[] {
  const updatedContents = [...navigationContents];

  // Find the section to add the page to
  const sectionIndex = updatedContents.findIndex(
    (item) => isSectionEntry(item) && item.section === sectionTitle
  );

  if (sectionIndex === -1) {
    throw new Error(`Section "${sectionTitle}" not found in navigation`);
  }

  const section = updatedContents[sectionIndex] as SectionEntry;

  // Add the page to the beginning of the section's contents
  const updatedSection: SectionEntry = {
    ...section,
    contents: [pageEntry, ...section.contents],
  };

  updatedContents[sectionIndex] = updatedSection;
  return updatedContents;
}

/**
 * Removes a page from a section in the navigation structure
 */
export function removePageFromSection(
  navigationContents: (PageEntry | SectionEntry)[],
  pagePath: string
): (PageEntry | SectionEntry)[] {
  return navigationContents
    .map((item): PageEntry | SectionEntry | null => {
      if (isSectionEntry(item)) {
        // This is a section, filter its contents
        // TODO: this should be done recursively
        const section = item;
        return {
          ...section,
          contents: section.contents.filter((contentItem) => {
            if (isPageEntry(contentItem)) {
              // This is a page, check if it matches the path to remove
              return contentItem.path !== pagePath;
            }
            // This is a subsection, keep it
            // TODO: nested sections should be handled recursively
            return true;
          }),
        };
      }
      // This is a top-level page, check if it matches the path to remove
      if (isPageEntry(item) && "path" in item && item.path === pagePath) {
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

  if (!docsConfig.navigation || !Array.isArray(docsConfig.navigation)) {
    throw new Error("Invalid docs.yml: missing or invalid navigation array");
  }

  // Add the page to the specified section
  const updatedNavigation = addPageToSection(
    docsConfig.navigation,
    sectionTitle,
    pageEntry
  );

  // Update the docs config
  const updatedConfig = {
    ...docsConfig,
    navigation: updatedNavigation,
  };

  return stringifyYaml(updatedConfig);
}

/**
 * Updates docs.yml navigation to remove a page
 */
export function removePageFromDocsYml(
  docsYmlContent: string,
  pagePath: string
): string {
  const docsConfig = parseYaml(docsYmlContent);

  if (!docsConfig.navigation || !Array.isArray(docsConfig.navigation)) {
    throw new Error("Invalid docs.yml: missing or invalid navigation array");
  }

  // Remove the page from navigation
  const updatedNavigation = removePageFromSection(
    docsConfig.navigation,
    pagePath
  );

  // Update the docs config
  const updatedConfig = {
    ...docsConfig,
    navigation: updatedNavigation,
  };

  return stringifyYaml(updatedConfig);
}
