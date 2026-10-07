import { NextRequest, NextResponse } from "next/server";
import { saveAmazonConnections } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const TOKEN_URL = "https://api.amazon.co.uk/auth/o2/token";
const PROFILES_URL = "https://advertising-api-eu.amazon.com/v2/profiles";

function page(message: string, ok = false) {
  return new NextResponse(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Amazon Ads</title></head><body style="font-family:system-ui;max-width:720px;margin:60px auto;padding:24px"><h1>${ok ? "Amazon Ads verbunden" : "Amazon-Verbindung"}</h1><p>${message}</p><p><a href="/">Zurück zum Amazon Ads Manager</a></p></body></html>`,
    { headers: { "Content-Type": "text/html;charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const response = (message: string, ok = false) => {
    const r = page(message, ok);
    r.cookies.set("amazon_oauth_state", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return r;
  };

  if (u.searchParams.get("error")) return response("Amazon hat die Autorisierung nicht abgeschlossen.");

  const state = u.searchParams.get("state");
  const savedState = req.cookies.get("amazon_oauth_state")?.value;
  if (!state || !savedState || state !== savedState) return page("Ungültiger OAuth-Status. Bitte die Verbindung erneut starten.");

  const code = u.searchParams.get("code");
  if (!code) return response("Kein Authorization Code von Amazon erhalten.");

  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return response("Die Amazon LWA Zugangsdaten fehlen in Vercel.");

  const redirectUri = `${process.env.APP_URL || u.origin}/api/amazon/callback`;
  const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });

  const tokenRes = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body, cache: "no-store" });
  const token = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !token.access_token || !token.refresh_token) return response("Der Amazon-Token konnte nicht sicher erstellt werden. Bitte erneut verbinden.");

  const profileRes = await fetch(PROFILES_URL, {
    headers: { Authorization: `Bearer ${token.access_token}`, "Amazon-Advertising-API-ClientId": clientId, Accept: "application/json" },
    cache: "no-store",
  });
  const profiles = await profileRes.json().catch(() => []);

  if (!profileRes.ok || !Array.isArray(profiles)) return response(`Amazon wurde autorisiert, aber das Ads-Profil konnte nicht abgerufen werden (HTTP ${profileRes.status}).`);
  if (!profiles.length) return response("Amazon wurde autorisiert, aber es wurde kein Amazon-Ads-Profil gefunden.");

  try {
    await saveAmazonConnections(token.refresh_token, profiles);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Supabase-Fehler.";
    return response(`Amazon wurde autorisiert, aber die sichere Speicherung in Supabase ist fehlgeschlagen. ${detail}`);
  }

  return response(`Die Amazon-Ads-Verbindung wurde erfolgreich gespeichert. ${profiles.length} Profil(e) gefunden.`, true);
}
