import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { GitHubLoader } from "@/app/services/github/github-loader";

interface GetDocsYmlRequest {
  owner: string;
  repo: string;
  branch: string;
  orgName: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: GetDocsYmlRequest = await request.json();
    const { owner, repo, branch, orgName } = body;

    if (!owner || !repo || !branch) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create GitHubLoader instance
    const gitLoader = new GitHubLoader(session.user.sub, orgName as any);

    // Get the docs.yml file
    const docsYmlContent = await gitLoader.getDocsYml(owner, repo, branch);
    if (!docsYmlContent) {
      return NextResponse.json(
        { error: "Failed to fetch docs.yml" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      docsYmlContent,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
