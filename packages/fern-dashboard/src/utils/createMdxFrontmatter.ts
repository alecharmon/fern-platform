/**
 * Creates a default MDX string with frontmatter for a page.
 * @param config - Configuration object containing frontmatter properties
 * @param config.title - The page title (required)
 * @param config.slug - The page slug (optional)
 * @param config.subtitle - The page subtitle (optional)
 * @returns A minimal MDX string with frontmatter
 */
export function createMdxFrontmatter(config: {
  title: string;
  slug?: string;
  subtitle?: string;
}): string {
  // Always include the title, even if it's an empty string
  const frontmatterLines = [`title: ${config.title ?? "''"}`];

  // Optionally include the subtitle and slug if they are provided
  if (config.subtitle) {
    frontmatterLines.push(`subtitle: ${config.subtitle ?? "''"}`);
  }
  if (config.slug) {
    frontmatterLines.push(`slug: ${config.slug ?? "''"}`);
  }

  return `---
${frontmatterLines.join("\n")}
---`;
}
