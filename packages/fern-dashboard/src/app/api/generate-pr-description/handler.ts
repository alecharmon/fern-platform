import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { createPrDescriptionService } from "@/app/services/pr-description";

export default async function generatePrDescription(request: {
    owner: string;
    repo: string;
    branch: string;
    baseBranch?: string;
    repoUrl?: string;
    site?: string;
    orgName?: string;
    slug?: string;
}): Promise<{
    success: boolean;
    error?: string;
    newTitle?: string;
}> {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: "No session found" };
    }

    // Check if this is a GitHub repo - AI PR description generation is GitHub-only for now
    const repoUrl = request.repoUrl || `https://github.com/${request.owner}/${request.repo}`;
    const parsed = parseGitUrl(repoUrl);
    if (parsed.provider !== "github") {
        // Gracefully skip for non-GitHub repos
        return { success: true }; // Return success to not block the flow
    }

    const octokitResult = await getFernBotOctokitForRepo(request.owner, request.repo);
    if (!octokitResult.ok) {
        // Gracefully handle when Fern bot is not installed
        return { success: true }; // Return success to not block the flow
    }

    const octokit = octokitResult.octokit;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
        return { success: false, error: "ANTHROPIC_API_KEY not configured" };
    }

    const prDescriptionService = createPrDescriptionService(octokit, anthropicApiKey, {
        name: session.user.name,
        email: session.user.email
    });

    return await prDescriptionService.generateAndUpdatePrTitleAndDescription({
        owner: request.owner,
        repo: request.repo,
        branch: request.branch,
        baseBranch: request.baseBranch,
        site: request.site,
        orgName: request.orgName,
        slug: request.slug
    });
}
