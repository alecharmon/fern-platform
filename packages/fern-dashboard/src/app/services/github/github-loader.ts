import "server-only";

import { Octokit } from "@octokit/core";

import { GitLoader } from "@fern-api/docs-loader";

import { getFernBotOctokitForRepo } from "../auth0/fernBotOctokit";
import { getCurrentSession } from "../auth0/getCurrentSession";
import { getOwnerAndRepoFromGithubUrl } from "./github";

/**
 * The GitHubLoader is used to get files from a remote GitHub repository.
 */
export class GitHubLoader implements GitLoader {
  private getOctokitInstance: () => Promise<Octokit | null>;
  private octokit: Octokit | null = null;

  constructor(githubUrl: string) {
    this.getOctokitInstance = async () => {
      const session = await getCurrentSession();
      if (!session) return null;

      const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
      if (!owner || !repo) return null;
      return getFernBotOctokitForRepo(owner, repo);
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

  async getDocsYml(
    owner: string,
    repo: string,
    ref: string = "main"
  ): Promise<string | null> {
    return this.getFileContent(owner, repo, ref, "fern/docs.yml");
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
