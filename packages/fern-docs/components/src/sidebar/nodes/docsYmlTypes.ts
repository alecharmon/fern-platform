export interface DocsYmlPageEntry {
  page: string;
  path?: string;
}

export interface DocsYmlUpdate {
  sectionTitle: string;
  pageEntry: DocsYmlPageEntry;
  createdAt: number;
  operation?: "add" | "remove"; // "add" is default for backward compatibility
}

export interface DocsYmlState {
  baseContent: string; // The original docs.yml content from GitHub
  updates: Record<string, DocsYmlUpdate>; // Pending updates keyed by page path
  lastFetched: number; // Timestamp when baseContent was last fetched
}
