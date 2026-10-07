const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCHEMA = "amazon_private";

function config() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase Server-Zugangsdaten fehlen.");
  }
  return { base: SUPABASE_URL.replace(/\/$/, ""), key: SUPABASE_SERVICE_ROLE_KEY };
}

function headers(extra: Record<string, string> = {}) {
  const { key } = config();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Accept-Profile": SCHEMA,
    "Content-Profile": SCHEMA,
    ...extra,
  };
}

export type AmazonConnection = {
  id: string;
  amazon_profile_id: string | null;
  profile_name: string | null;
  country_code: string | null;
  created_at: string;
  updated_at: string;
};

export async function saveAmazonConnections(
  refreshToken: string,
  profiles: Array<{
    profileId: string | number;
    countryCode?: string | null;
    accountInfo?: { name?: string | null } | null;
  }>
) {
  const { base } = config();

  const deleteRes = await fetch(`${base}/rest/v1/connections?id=not.is.null`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=minimal" }),
    cache: "no-store",
  });

  if (!deleteRes.ok) {
    throw new Error("Gespeicherte Amazon-Verbindungen konnten nicht aktualisiert werden.");
  }

  const rows = profiles.map((profile) => ({
    amazon_profile_id: String(profile.profileId),
    profile_name: profile.accountInfo?.name ?? null,
    country_code: profile.countryCode ?? null,
    refresh_token: refreshToken,
  }));

  const insertRes = await fetch(`${base}/rest/v1/connections`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!insertRes.ok) {
    throw new Error("Die Amazon-Verbindung konnte nicht in Supabase gespeichert werden.");
  }
}

export async function getAmazonConnections(): Promise<AmazonConnection[]> {
  const { base } = config();
  const res = await fetch(
    `${base}/rest/v1/connections?select=id,amazon_profile_id,profile_name,country_code,created_at,updated_at&order=created_at.asc`,
    { headers: headers(), cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Amazon-Verbindungen konnten nicht geladen werden.");
  }

  return res.json();
}
