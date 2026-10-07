import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const error = u.searchParams.get("error");
  if (error) {
    return NextResponse.json(
      {error, description:u.searchParams.get("error_description")},
      {status:400}
    );
  }

  const state = u.searchParams.get("state");
  const cookieState = req.headers.get("cookie")
    ?.match(/(?:^|; )amazon_oauth_state=([^;]+)/)?.[1];

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      {error:"Ungültiger OAuth-Status (state). Bitte erneut verbinden."},
      {status:400}
    );
  }

  const code = u.searchParams.get("code");
  if (!code) {
    return NextResponse.json({error:"Kein Authorization Code erhalten."},{status:400});
  }

  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {error:"Amazon LWA Zugangsdaten fehlen in den Vercel Environment Variables."},
      {status:500}
    );
  }

  const redirectUri = (process.env.APP_URL || u.origin) + "/api/amazon/callback";
  const body = new URLSearchParams({
    grant_type:"authorization_code",
    code,
    client_id:clientId,
    client_secret:clientSecret,
    redirect_uri:redirectUri
  });

  const tokenRes = await fetch("https://api.amazon.co.uk/auth/o2/token", {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json(
      {error:"Amazon Token-Austausch fehlgeschlagen", details:data},
      {status:tokenRes.status}
    );
  }

  const response = new NextResponse(
    "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Amazon verbunden</title></head><body style=\"font-family:system-ui;max-width:700px;margin:60px auto;padding:20px\"><h1>Amazon Ads erfolgreich autorisiert</h1><p>Die OAuth-Autorisierung war erfolgreich.</p><p>Der nächste Schritt ist die sichere Speicherung des Refresh Tokens und der Abruf des Amazon-Ads-Profils.</p></body></html>",
    {headers:{"Content-Type":"text/html;charset=utf-8"}}
  );

  response.cookies.set("amazon_oauth_state","",{
    httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0
  });
  return response;
}
