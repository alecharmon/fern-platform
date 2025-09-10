import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { GithubCommitableFile } from "@/app/services/github/types";

export default async function postGitCommit(request: {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: GithubCommitableFile[];
}): Promise<{
  success: boolean;
  error?: string;
  commitSha?: string;
}> {
  const session = await getCurrentSession();
  if (session == null) {
    return { success: false, error: "No session found" };
  }

  const octokitResult = await getFernBotOctokitForRepo(
    request.owner,
    request.repo
  );

  if (!octokitResult.ok) {
    throw new Error(`Failed to get GitHub client: ${octokitResult.error.type}`);
  }

  const octokit = octokitResult.octokit;

  try {
    // Get the current tree SHA for the branch
    const refResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      {
        owner: request.owner,
        repo: request.repo,
        ref: `heads/${request.branch}`,
      }
    );

    if (!refResponse.data.object?.sha) {
      throw new Error("Failed to get branch SHA");
    }
    const baseSha = refResponse.data.object.sha;

    // Get the current commit to get the tree SHA
    const commitResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      {
        owner: request.owner,
        repo: request.repo,
        commit_sha: baseSha,
      }
    );

    if (!commitResponse.data.tree?.sha) {
      throw new Error("Failed to get tree SHA");
    }
    const baseTreeSha = commitResponse.data.tree.sha;

    // Get the base tree to check which files actually exist
    const baseTreeResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      {
        owner: request.owner,
        repo: request.repo,
        tree_sha: baseTreeSha,
        recursive: "true", // Get all files recursively
      }
    );

    // Create a set of existing file paths for quick lookup
    const existingFiles = new Set(
      baseTreeResponse.data.tree
        ?.filter((item) => item.type === "blob")
        .map((item) => item.path) || []
    );

    // Create a new tree with the files
    const tree = request.files
      .map((file) => {
        if (file.delete) {
          // Only include deletion entries for files that actually exist in the base tree
          if (!existingFiles.has(file.path)) {
            return null;
          }
          // For deletions of existing files, GitHub still requires mode and type
          return {
            path: file.path,
            mode: (file.mode || "100644") as
              | "100644"
              | "100755"
              | "040000"
              | "160000"
              | "120000",
            type: "blob" as const,
            sha: null,
          };
        } else {
          // Validate file content exists
          if (file.content == null) {
            throw new Error(`File ${file.path} has no content`);
          }

          return {
            path: file.path,
            mode: (file.mode || "100644") as
              | "100644"
              | "100755"
              | "040000"
              | "160000"
              | "120000",
            type: "blob" as const,
            content: file.content,
          };
        }
      })
      .filter((item) => item != null); // Remove null entries

    const {
      data: { sha: newTreeSha },
    } = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
      owner: request.owner,
      repo: request.repo,
      base_tree: baseTreeSha,
      tree,
    });

    // Create a new commit
    const {
      data: { sha: commitSha },
    } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
      owner: request.owner,
      repo: request.repo,
      message: request.message,
      tree: newTreeSha,
      parents: [baseSha],
    });

    // Update the branch reference to point to the new commit
    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.branch}`,
      sha: commitSha,
    });

    return {
      success: true,
      commitSha,
    };
  } catch (error) {
    console.error("Failed to commit changes", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
