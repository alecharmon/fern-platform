import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const postmanTeamId = req.nextUrl.searchParams.get("postmanTeamId");
    if (!postmanTeamId) {
        return NextResponse.json({ error: "postmanTeamId is required" }, { status: 400 });
    }

    const venusServerUrl = process.env.VENUS_SERVER_URL;
    if (!venusServerUrl) {
        return NextResponse.json({ error: "Venus server URL not configured" }, { status: 500 });
    }

    try {
        const response = await fetch(
            `${venusServerUrl}/organizations/postman-team/${encodeURIComponent(postmanTeamId)}/org-ids`,
            { method: "GET" }
        );

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json([]);
            }
            return NextResponse.json(
                { error: "Failed to fetch org IDs for postman team" },
                { status: response.status }
            );
        }

        const orgId: string = await response.json();
        // Venus returns a single org_id string; wrap it in an array for the UI
        return NextResponse.json([orgId]);
    } catch (error) {
        console.error("Error fetching org IDs by postman team ID:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
