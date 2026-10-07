import { getAmazonConnectionByProfileId } from "@/lib/supabaseAdmin";

const TOKEN_URL = "https://api.amazon.co.uk/auth/o2/token";
const ADS_API_URL = "https://advertising-api-eu.amazon.com";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

export type AmazonCampaign = {
  campaignId: string;
  name: string;
  state?: string;
  campaignType?: string;
  dailyBudget?: number;
  startDate?: string;
  endDate?: string;
};

async function getAccessToken(refreshToken: string) {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Amazon LWA Zugangsdaten fehlen.");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({} as TokenResponse));
  if (!res.ok || !data.access_token) throw new Error("Amazon-Zugriffstoken konnte nicht erneuert werden.");
  return data.access_token;
}

export async function getSponsoredProductsCampaigns(profileId: string): Promise<AmazonCampaign[]> {
  const connection = await getAmazonConnectionByProfileId(profileId);
  if (!connection?.refresh_token) throw new Error("Amazon-Profil nicht gefunden.");

  const accessToken = await getAccessToken(connection.refresh_token);
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  if (!clientId) throw new Error("Amazon LWA Client-ID fehlt.");

  const res = await fetch(`${ADS_API_URL}/sp/campaigns/list`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/vnd.spCampaign.v3+json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      stateFilter: { include: ["ENABLED", "PAUSED"] },
      maxResults: 100,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data === "object" && data ? JSON.stringify(data).slice(0,500) : "";
    throw new Error(`Amazon-Kampagnen konnten nicht geladen werden (HTTP ${res.status}). ${detail}`);
  }

  const campaigns = Array.isArray(data) ? data : (data.campaigns ?? data.campaignsList ?? []);
  return campaigns.map((c: any) => ({
    campaignId: String(c.campaignId ?? c.id),
    name: String(c.name ?? "Ohne Namen"),
    state: c.state,
    campaignType: c.campaignType,
    dailyBudget: c.dailyBudget,
    startDate: c.startDate,
    endDate: c.endDate,
  })).filter((c: AmazonCampaign) => c.campaignId && c.campaignId !== "undefined");
}
