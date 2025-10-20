import { NextResponse } from "next/server";
import { parseNextRequestBody } from "../../utils/parseNextRequestBody";
import createSeverity from "./handler";

export async function POST(request: Request) {
    try {
        const body = await parseNextRequestBody(request);
        const result = await createSeverity(body);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
