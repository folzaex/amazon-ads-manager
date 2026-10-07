import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: Request) {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {error:"AMAZON_LWA_CLIENT_ID fehlt in den Vercel Environment Variables."},
      {status:500}
    );
  }

  const requestUrl = new URL(req.url);
  const base = process.env.APP_URL || requestUrl.origin;
  const redirectUri = base + "/api/amazon/callback";
  const state = randomBytes(24).toString("hex");

  const auth = new URL("https://eu.account.amazon.com/ap/oa");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("scope", "advertising::campaign_management");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("state", state);

  const response = NextResponse.redirect(auth.toString());
  response.cookies.set("amazon_oauth_state", state, {
    httpOnly:true, secure:true, sameSite:"lax", path:"/", maxAge:600
  });
  return response;
}
