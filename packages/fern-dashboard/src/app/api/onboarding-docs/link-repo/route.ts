import { type NextRequest, NextResponse } from "next/server";
import postDocsGithubSourceHandler from "@/app/api/post-docs-github-source/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LinkRepoRequest {
    docsUrl: string;
    githubUrl: string;
}

/**
 * Links a GitHub repository to a docs site.
 * Called by LoaderScreen after the workflow completes and the docs site exists in FDR.
 *
 * Security: We do NOT accept orgName from the client to prevent unauthorized linking.
 * The org is looked up from FDR based on the docs URL, which validates ownership.
 */
export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: LinkRepoRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!data.docsUrl || !data.githubUrl) {
        return NextResponse.json({ error: "docsUrl and githubUrl are required" }, { status: 400 });
    }

    console.log(`[link-repo] Linking ${data.githubUrl} to ${data.docsUrl}`);

    try {
        // Do NOT pass orgName - let the handler look it up from FDR
        // This ensures we validate that the docs URL exists and get the correct org
        const result = await postDocsGithubSourceHandler({
            url: data.docsUrl,
            token: session.accessToken,
            githubUrl: data.githubUrl
            // orgName intentionally omitted for security
        });

        if (result.ok) {
            console.log(`[link-repo] Successfully linked repo`);
            return NextResponse.json({ success: true });
        } else {
            console.error(`[link-repo] Failed to link repo:`, JSON.stringify(result.error, null, 2));
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
    } catch (error) {
        console.error("[link-repo] Exception:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
