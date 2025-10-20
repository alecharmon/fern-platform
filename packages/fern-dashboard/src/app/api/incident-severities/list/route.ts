import { NextResponse } from "next/server";
import listSeverities from "./handler";

export async function GET() {
    try {
        const result = await listSeverities();
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
