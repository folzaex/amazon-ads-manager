const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCHEMA = "amazon_private";

function config() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase Server-Zugangsdaten fehlen.");
  }
  return { base: SUPABASE_URL.replace(/\/$/, "").trim(), key: SUPABASE_SERVICE_ROLE_KEY.trim() };
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

async function explain(res: Response) {
  const body = await res.text().catch(() => "");
  const detail = body.replace(/\s+/g, " ").trim().slice(0, 500);
  return detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`;
}

async function supabaseFetch(url: string, init: RequestInit, stage: string) {
  try {
    return await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause instanceof Error ? `; Ursache: ${error.cause.message}` : "";
    throw new Error(`Supabase-Netzwerkfehler bei ${stage}: ${message}${cause}`);
  }
}

export type AmazonConnection = {
  id: string;
  amazon_profile_id: string | null;
  profile_name: string | null;
  country_code: string | null;
  created_at: string;
  updated_at: string;
  refresh_token: string;
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

  const deleteRes = await supabaseFetch(
    `${base}/rest/v1/connections?id=not.is.null`,
    {
      method: "DELETE",
      headers: headers({ Prefer: "return=minimal" }),
      cache: "no-store",
    },
    "Löschen bestehender Verbindungen"
  );

  if (!deleteRes.ok) {
    throw new Error(`Supabase konnte bestehende Verbindungen nicht löschen: ${await explain(deleteRes)}`);
  }

  const rows = profiles.map((profile) => ({
    amazon_profile_id: String(profile.profileId),
    profile_name: profile.accountInfo?.name ?? null,
    country_code: profile.countryCode ?? null,
    refresh_token: refreshToken,
  }));

  const insertRes = await supabaseFetch(
    `${base}/rest/v1/connections`,
    {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(rows),
      cache: "no-store",
    },
    "Speichern der Amazon-Verbindung"
  );

  if (!insertRes.ok) {
    throw new Error(`Supabase konnte die Amazon-Verbindung nicht speichern: ${await explain(insertRes)}`);
  }
}

export async function getAmazonConnectionByProfileId(profileId: string): Promise<AmazonConnection | null> {
  const { base } = config();
  const res = await supabaseFetch(
    `${base}/rest/v1/connections?select=id,amazon_profile_id,profile_name,country_code,created_at,updated_at&amazon_profile_id=eq.${encodeURIComponent(profileId)}&limit=1`,
    { headers: headers(), cache: "no-store" },
    "Laden des Amazon-Profils"
  );

  if (!res.ok) {
    throw new Error(`Amazon-Profil konnte nicht geladen werden: ${await explain(res)}`);
  }

  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function getAmazonConnections(): Promise<AmazonConnection[]> {
  const { base } = config();
  const res = await supabaseFetch(
    `${base}/rest/v1/connections?select=id,amazon_profile_id,profile_name,country_code,created_at,updated_at&order=created_at.asc`,
    { headers: headers(), cache: "no-store" },
    "Laden der Amazon-Verbindungen"
  );

  if (!res.ok) {
    throw new Error(`Amazon-Verbindungen konnten nicht geladen werden: ${await explain(res)}`);
  }

  return res.json();
}
