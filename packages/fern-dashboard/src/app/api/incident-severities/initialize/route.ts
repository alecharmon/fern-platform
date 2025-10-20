import { NextResponse } from "next/server";
import initializeSeverities from "./handler";

export async function POST() {
    try {
        const result = await initializeSeverities();
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
