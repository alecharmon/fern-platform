import "server-only";

import { Octokit } from "@octokit/core";
import yaml from "js-yaml";
import z from "zod";

import {
  FernProject,
  GetDocsYmlResult,
  GetFernConfigJsonResult,
  GetFernProjectResult,
  GitLoader,
  UpdateDocsYmlResult,
} from "@fern-api/docs-loader";

import { getFernBotOctokitForRepo } from "../auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "./github";

// Types and interfaces
interface DocsYmlConfig {
  instances?: {
    url: string;
    ["custom-domain"]?: string;
  }[];
}

/**
 * The GitHubLoader is used to get files from a remote GitHub repository.
 */
export class GitHubLoader implements GitLoader {
  private getOctokitInstance: () => Promise<Octokit | null>;
  private octokit: Octokit | null = null;

  constructor(githubUrl: string) {
    this.getOctokitInstance = async () => {
      const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
      if (!owner || !repo) return null;

      const result = await getFernBotOctokitForRepo(owner, repo);
      return result.ok ? result.octokit : null;
    };
  }

  async getOctokit() {
    if (this.octokit == null) {
      this.octokit = await this.getOctokitInstance();
    }
    return this.octokit;
  }

  /**
   * Helper function to get the content of a file from a GitHub repository. If docs.yml
   * files are divided into multiple files, we can reuse this for each file we need.
   *
   * NOTE: I have not yet handled the recursion needed to get all docs.yml files and sub-files.
   */
  private async getFileContent(
    owner: string,
    repo: string,
    ref: string,
    path: string
  ): Promise<string | null> {
    try {
      const octokit = await this.getOctokit();
      if (!octokit) {
        console.error("Failed to get Octokit instance");
        return null;
      }

      const response = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        {
          owner,
          repo,
          path,
          ref,
        }
      );

      if ("content" in response.data) {
        const content = Buffer.from(response.data.content, "base64").toString(
          "utf8"
        );
        return content;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch ${path} from ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Parses a docs.yml YAML content and extracts the list of URLs from the instances section
   */
  private parseUrlsFromDocsYml(yamlContent: string): string[] {
    try {
      const config = yaml.load(yamlContent) as DocsYmlConfig;
      if (!config?.instances || !Array.isArray(config.instances)) {
        return [];
      }

      return config.instances
        .filter(
          (instance): instance is { url: string } =>
            typeof instance === "object" &&
            instance != null &&
            "url" in instance &&
            typeof instance.url === "string"
        )
        .flatMap((instance) => {
          if (
            "custom-domain" in instance &&
            typeof instance["custom-domain"] === "string"
          ) {
            return [instance.url, instance["custom-domain"]];
          }

          return [instance.url];
        });
    } catch (error) {
      console.error("Failed to parse YAML content:", error);
      return [];
    }
  }

  private async getRepository(owner: string, repo: string) {
    const octokit = await this.getOctokit();
    if (!octokit) {
      throw new Error("Failed to get Octokit instance");
    }

    try {
      const repositoryResponse = await octokit.request(
        "GET /repos/{owner}/{repo}",
        {
          owner,
          repo,
        }
      );

      return repositoryResponse;
    } catch (error: any) {
      if (error?.status === 404) {
        return null;
      }

      throw error;
    }
  }
  /**
   * Finds a Fern project by site URL using tree searching methodology.
   * Returns the paths to both docs.yml and fern.config.json for the matching project.
   */
  async getFernProjectBySite(
    owner: string,
    repo: string,
    site: string
  ): Promise<GetFernProjectResult> {
    const octokit = await this.getOctokit();
    if (!octokit) {
      throw new Error("Failed to get Octokit instance");
    }

    const repository = await this.getRepository(owner, repo);
    if (repository == null) {
      return {
        type: "error",
        error: {
          type: "REPO_NOT_FOUND",
        },
      };
    }

    const defaultBranch = repository.data.default_branch;

    // Get the full repository tree
    const treeResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      {
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: "true",
      }
    );

    // Find all fern.config.json files
    const fernConfigPaths = treeResponse.data.tree
      .filter(
        (item) =>
          item.type === "blob" &&
          item.path.endsWith("fern.config.json") &&
          item.path.split("/").pop() === "fern.config.json" // Ensure it's exactly "fern.config.json"
      )
      .map((item) => item.path);

    const projects: FernProject[] = [];

    // For each fern.config.json, look for a sibling docs.yml
    for (const fernConfigPath of fernConfigPaths) {
      const fernDir = fernConfigPath.replace("/fern.config.json", "");
      const docsYmlPath = `${fernDir}/docs.yml`;

      // Check if docs.yml exists in the same directory
      const docsYmlExists = treeResponse.data.tree.some(
        (item) => item.type === "blob" && item.path === docsYmlPath
      );

      if (docsYmlExists) {
        projects.push({
          docsYmlPath,
          fernConfigJsonPath: fernConfigPath,
        });
      }
    }

    if (projects.length === 0) {
      return {
        type: "error",
        error: {
          type: "NO_PROJECTS",
        },
      };
    }

    const matchingProjects: FernProject[] = [];

    for (const project of projects) {
      const docsYmlContent = await this.getFileContent(
        owner,
        repo,
        defaultBranch,
        project.docsYmlPath
      );
      if (docsYmlContent) {
        const urls = this.parseUrlsFromDocsYml(docsYmlContent);

        // Strip https:// or http://
        /* this isn't the most efficient way to do this, but this isn't a frequently executed code path so it is okay */
        const HTTP = "http://";
        const HTTPS = "https://";

        const strippedUrls = urls.map((url) => {
          if (url.startsWith(HTTPS)) {
            return url.slice(HTTPS.length);
          } else if (url.startsWith(HTTP)) {
            return url.slice(HTTP.length);
          }
          return url;
        });

        const strippedSite = site.startsWith(HTTPS)
          ? site.slice(HTTPS.length)
          : site.startsWith(HTTP)
            ? site.slice(HTTP.length)
            : site;

        // Check if any URL matches the site
        if (strippedUrls.includes(strippedSite)) {
          matchingProjects.push(project);
        }
      }
    }

    // Handle multiple matches as an error
    if (matchingProjects.length > 1) {
      console.error(
        `Multiple Fern projects found with site URL "${site}". Found in: ${matchingProjects
          .map((p) => p.docsYmlPath)
          .join(", ")}`
      );
      return {
        type: "error",
        error: { type: "MULTIPLE_PROJECTS_WITH_SITE" },
      };
    }

    const matchingProject = matchingProjects[0];
    // Return success if exactly one project found, or error if none found
    if (matchingProject != null) {
      return {
        type: "ok",
        result: {
          defaultBranch,
          project: matchingProject,
        },
      };
    } else {
      return {
        type: "error",
        error: { type: "SITE_NOT_FOUND" },
      };
    }
  }

  async getDocsYml(
    owner: string,
    repo: string,
    site: string,
    ref: string = "main"
  ): Promise<GetDocsYmlResult> {
    const projectResult = await this.getFernProjectBySite(owner, repo, site);
    if (projectResult.type === "error") {
      return {
        type: "error",
        error: projectResult.error,
      };
    }

    const content = await this.getFileContent(
      owner,
      repo,
      ref,
      projectResult.result.project.docsYmlPath
    );
    if (!content) {
      return {
        type: "error",
        error: { type: "DOCS_YML_MISSING" },
      };
    }

    return {
      type: "ok",
      result: content,
    };
  }

  async updateDocsYml(
    owner: string,
    repo: string,
    site: string,
    content: string,
    ref: string = "main"
  ): Promise<UpdateDocsYmlResult> {
    const projectResult = await this.getFernProjectBySite(owner, repo, site);
    if (projectResult.type === "error") {
      return {
        type: "error",
        error: projectResult.error,
      };
    }
    const octokit = await this.getOctokit();
    if (!octokit) {
      throw new Error("Failed to get Octokit instance");
    }

    // Get the current file to obtain its SHA
    const currentFile = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner,
        repo,
        path: projectResult.result.project.docsYmlPath,
        ref,
      }
    );

    if (!("sha" in currentFile.data)) {
      return {
        type: "error",
        error: { type: "DOCS_YML_MISSING" },
      };
    }

    // Update the file
    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path: projectResult.result.project.docsYmlPath,
      message: "Update docs.yml - add new page via visual editor",
      content: Buffer.from(content, "utf8").toString("base64"),
      sha: currentFile.data.sha,
      branch: ref,
    });

    return { type: "ok" };
  }

  async getFernConfigJson(
    owner: string,
    repo: string,
    site: string
  ): Promise<GetFernConfigJsonResult> {
    const projectResult = await this.getFernProjectBySite(owner, repo, site);
    if (projectResult.type === "error") {
      return {
        type: "error",
        error: projectResult.error,
      };
    }

    const pathToFernConfigJson =
      projectResult.result.project.fernConfigJsonPath;

    const content = await this.getFileContent(
      owner,
      repo,
      projectResult.result.defaultBranch,
      pathToFernConfigJson
    );
    if (!content) {
      return {
        type: "error",
        error: { type: "FERN_CONFIG_JSON_MISSING" },
      };
    }

    let parsedContent: object;
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      return {
        type: "error",
        error: {
          type: "FERN_CONFIG_JSON_MALFORMED",
          parsingErrorMessage:
            error instanceof Error ? error.message : String(error),
        },
      };
    }

    const maybeConfig = fernConfigSchema.safeParse(parsedContent);
    if (!maybeConfig.success) {
      return {
        type: "error",
        error: {
          type: "FERN_CONFIG_JSON_MALFORMED",
          parsingErrorMessage: maybeConfig.error.message,
        },
      };
    }

    return {
      type: "ok",
      result: {
        ...maybeConfig.data,
        pathToFernConfigJson,
      },
    };
  }
}

const fernConfigSchema = z.object({
  organization: z.string(),
  version: z.string(),
});
