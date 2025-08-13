import { Octokit } from "@octokit/core";

import { GitLoader } from "@fern-api/docs-loader";

import { getOctokit } from "../auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "../auth0/types";

/**
 * The GitHubLoader is used to get files from a remote GitHub repository.
 */
export class GitHubLoader implements GitLoader {
  private getOctokitInstance: () => Promise<Octokit | null>;
  private octokit: Octokit | null = null;

  constructor(userId: Auth0UserID, orgName?: Auth0OrgName) {
    this.getOctokitInstance = () => getOctokit(userId, orgName);
  }

  async getOctokit() {
    if (this.octokit == null) {
      this.octokit = await this.getOctokitInstance();
    }
    return this.octokit;
  }

  async getDocsYml(
    owner: string,
    repo: string,
    ref: string = "main"
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
          path: "fern/docs.yml",
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
      console.error(`Failed to fetch docs.yml from ${owner}/${repo}:`, error);
      return null;
    }
  }

  async updateDocsYml(
    owner: string,
    repo: string,
    content: string,
    ref: string = "main"
  ): Promise<boolean> {
    try {
      const octokit = await this.getOctokit();
      if (!octokit) {
        console.error("GitHubLoader: Failed to get Octokit instance");
        return false;
      }

      const fullPath = "fern/docs.yml";

      // Get the current file to obtain its SHA
      const currentFile = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        {
          owner,
          repo,
          path: fullPath,
          ref,
        }
      );

      if (!("sha" in currentFile.data)) {
        throw new Error("docs.yml file not found or invalid response");
      }

      // Update the file
      await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path: fullPath,
        message: "Update docs.yml - add new page via visual editor",
        content: Buffer.from(content, "utf8").toString("base64"),
        sha: currentFile.data.sha,
        branch: ref,
      });

      return true;
    } catch (error) {
      console.error(
        `GitHubLoader: Failed to update docs.yml in ${owner}/${repo}:`,
        error
      );
      return false;
    }
  }
}
