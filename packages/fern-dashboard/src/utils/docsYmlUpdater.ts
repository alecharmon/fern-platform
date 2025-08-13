import yaml from "js-yaml";

export interface PageEntry {
  page: string;
  path?: string;
}

export interface SectionEntry {
  section: string;
  contents: (PageEntry | SectionEntry)[];
}

export interface DocsConfig {
  navigation?: (PageEntry | SectionEntry)[];
  [key: string]: any;
}

/**
 * Parses a YAML string into a JavaScript object
 */
export function parseYaml(yamlContent: string): any {
  try {
    return yaml.load(yamlContent);
  } catch (error) {
    console.error("Error parsing YAML:", error);
    throw new Error("Failed to parse YAML content");
  }
}

/**
 * Converts a JavaScript object to a YAML string
 */
export function stringifyYaml(obj: any): string {
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
  navigationContents: any[],
  sectionTitle: string,
  pageEntry: PageEntry
): any[] {
  const updatedContents = [...navigationContents];

  // Find the section to add the page to
  const sectionIndex = updatedContents.findIndex((item) => {
    return (
      typeof item === "object" &&
      item != null &&
      "section" in item &&
      item.section === sectionTitle
    );
  });

  if (sectionIndex === -1) {
    throw new Error(`Section "${sectionTitle}" not found in navigation`);
  }

  const section = updatedContents[sectionIndex] as SectionEntry;

  // Add the page to the beginning of the section's contents
  const updatedSection = {
    ...section,
    contents: [pageEntry, ...section.contents],
  };

  updatedContents[sectionIndex] = updatedSection;
  return updatedContents;
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
