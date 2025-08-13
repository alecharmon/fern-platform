import { cache } from "react";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { HttpMethod } from "@fern-api/docs-utils";
import type { DocsV1Read } from "@fern-api/fdr-sdk";
import type {
  EndpointId,
  PruningNodeType,
} from "@fern-api/fdr-sdk/api-definition";

import { createCachedDocsLoader } from "./readonly-docs-loader";

/**
 * The EditableDocsLoader combines a read-only docs loader with a git loader.
 * The read-only docs loader is used to get docs metadata.
 * The git loader is used to get files from a remote git repository.
 */
class EditableDocsLoader implements DocsLoader {
  private readOnlyDocsLoader: DocsLoader;
  domain: string;
  fern_token: string | undefined;

  constructor(
    docsLoader: DocsLoader,
    private gitLoader?: GitLoader
  ) {
    this.readOnlyDocsLoader = docsLoader;
    this.domain = docsLoader.domain;
    this.fern_token = docsLoader.fern_token;
  }

  getDocsYml = (owner: string, repo: string, ref?: string) =>
    this.gitLoader?.getDocsYml(owner, repo, ref) ?? Promise.resolve(null);

  updateDocsYml = (
    owner: string,
    repo: string,
    content: string,
    ref?: string
  ) =>
    this.gitLoader?.updateDocsYml(owner, repo, content, ref) ??
    Promise.resolve(false);

  getAuthConfig = () => this.readOnlyDocsLoader.getAuthConfig();

  getMetadata = () => this.readOnlyDocsLoader.getMetadata();

  getFiles = () => this.readOnlyDocsLoader.getFiles();

  getMdxBundlerFiles = () => this.readOnlyDocsLoader.getMdxBundlerFiles();

  getPrunedApi = (id: string, ...nodes: PruningNodeType[]) =>
    this.readOnlyDocsLoader.getPrunedApi(id, ...nodes);

  getEndpointById = (apiDefinitionId: string, endpointId: EndpointId) =>
    this.readOnlyDocsLoader.getEndpointById(apiDefinitionId, endpointId);

  getEndpointByLocator = (method: HttpMethod, path: string, example?: string) =>
    this.readOnlyDocsLoader.getEndpointByLocator(method, path, example);

  getRoot = () => this.readOnlyDocsLoader.getRoot();

  getNavigationNode = (id: string) =>
    this.readOnlyDocsLoader.getNavigationNode(id);

  unsafe_getFullRoot = () => this.readOnlyDocsLoader.unsafe_getFullRoot();

  getConfig = (): Promise<
    Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">
  > => this.readOnlyDocsLoader.getConfig();

  getPage = (pageId: string) => this.readOnlyDocsLoader.getPage(pageId);

  getColors = () => this.readOnlyDocsLoader.getColors();

  getFonts = () => this.readOnlyDocsLoader.getFonts();

  getLayout = () => this.readOnlyDocsLoader.getLayout();

  getAuthState = (pathname?: string) =>
    this.readOnlyDocsLoader.getAuthState(pathname);

  getEdgeFlags = () => this.readOnlyDocsLoader.getEdgeFlags();

  getBaseUrl = () => this.readOnlyDocsLoader.getBaseUrl();
}

/**
 * The GitLoader is used to get and update docs.yml from a remote git repository.
 */
export interface GitLoader {
  getDocsYml(owner: string, repo: string, ref?: string): Promise<string | null>;
  updateDocsYml(
    owner: string,
    repo: string,
    content: string,
    ref?: string
  ): Promise<boolean>;
}

export const createEditableDocsLoader = cache(
  async (
    host: string,
    encodedDocsUrl: string,
    fern_token?: string,
    gitLoader?: GitLoader,
    forceRevalidate?: boolean
  ) => {
    // TODO: derive the domain from the workspace
    const docsLoader = await createCachedDocsLoader(
      host,
      decodeURIComponent(encodedDocsUrl),
      fern_token,
      {
        // For editable docs, we want shorter TTL so that cache stays fresh
        kvTtl: 5 * 60, // 5 minutes
        cacheKeySuffix: "editable",
        forceRevalidate,
      },
      true // Skip auth
    );

    return new EditableDocsLoader(docsLoader, gitLoader);
  }
);
