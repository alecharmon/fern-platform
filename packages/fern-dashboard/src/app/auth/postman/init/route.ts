import { NextResponse } from "next/server";

const POSTMAN_IDENTITY_URL = "https://identity.getpostman.com/auth/fern";
const FIXED_STATE = "fixedstate";

export async function GET(): Promise<NextResponse> {
    const redirectUrl = `${POSTMAN_IDENTITY_URL}?state=${FIXED_STATE}`;
    return NextResponse.redirect(redirectUrl);
}
