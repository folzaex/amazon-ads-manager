const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type AmazonConnectionSecret = {
  amazon_profile_id: string | null;
  refresh_token: string | null;
};

export async function getAmazonConnectionSecret(profileId: string): Promise<AmazonConnectionSecret | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase Server-Zugangsdaten fehlen.");
  }

  const url = new URL(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/connections");
  url.searchParams.set("select", "amazon_profile_id,refresh_token");
  url.searchParams.set("amazon_profile_id", `eq.${profileId}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Accept-Profile": "amazon_private",
      "Content-Profile": "amazon_private",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Amazon-Profil konnte nicht geladen werden: HTTP ${res.status} ${detail.slice(0,300)}`);
  }

  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}
