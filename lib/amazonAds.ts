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

export async function getAmazonAccessToken(refreshToken: string) {
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

  const accessToken = await getAmazonAccessToken(connection.refresh_token);
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  if (!clientId) throw new Error("Amazon LWA Client-ID fehlt.");

  const res = await fetch(`${ADS_API_URL}/sp/campaigns/list`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/vnd.spCampaign.v3+json",
      Accept: "application/vnd.spCampaign.v3+json",
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


export async function createSponsoredProductsCampaignReport(
  profileId: string,
  startDate: string,
  endDate: string
) {
  const connection = await getAmazonConnectionByProfileId(profileId);
  if (!connection?.refresh_token) throw new Error("Amazon-Profil nicht gefunden.");
  const accessToken = await getAmazonAccessToken(connection.refresh_token);
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  if (!clientId) throw new Error("Amazon LWA Client-ID fehlt.");

  const res = await fetch(`${ADS_API_URL}/reporting/reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/vnd.createasyncreportrequest.v3+json",
    },
    body: JSON.stringify({
      name: `BookForge SP campaigns ${startDate} - ${endDate}`,
      startDate,
      endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["campaign"],
        columns: [
          "campaignId","impressions","clicks","cost","spend",
          "purchases1d","purchases7d","purchases14d",
          "sales1d","sales7d","sales14d",
          "unitsSoldClicks14d","campaignStatus","campaignName",
          "campaignBudgetCurrencyCode","startDate","endDate"
        ],
        reportTypeId: "spCampaigns",
        timeUnit: "SUMMARY",
        format: "GZIP_JSON",
      },
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.reportId) {
    const detail = typeof data === "object" && data ? JSON.stringify(data).slice(0,700) : "";
    throw new Error(`Amazon-Report konnte nicht erstellt werden (HTTP ${res.status}). ${detail}`);
  }
  return String(data.reportId);
}


export async function createSponsoredProductsCampaignDailyReport(
  profileId: string,
  startDate: string,
  endDate: string
) {
  const connection = await getAmazonConnectionByProfileId(profileId);
  if (!connection?.refresh_token) throw new Error("Amazon-Profil nicht gefunden.");
  const accessToken = await getAmazonAccessToken(connection.refresh_token);
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  if (!clientId) throw new Error("Amazon LWA Client-ID fehlt.");

  const res = await fetch(`${ADS_API_URL}/reporting/reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/vnd.createasyncreportrequest.v3+json",
    },
    body: JSON.stringify({
      name: `BookForge SP daily campaigns ${startDate} - ${endDate}`,
      startDate,
      endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["campaign"],
        columns: [
          "date","campaignId","impressions","clicks","cost","spend",
          "purchases1d","purchases7d","purchases14d",
          "sales1d","sales7d","sales14d",
          "unitsSoldClicks14d","campaignStatus","campaignName"
        ],
        reportTypeId: "spCampaigns",
        timeUnit: "DAILY",
        format: "GZIP_JSON",
      },
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.reportId) {
    const detail = typeof data === "object" && data ? JSON.stringify(data).slice(0,700) : "";
    const duplicateId = typeof data?.detail === "string" ? data.detail.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] : undefined;
    if (res.status === 425 && duplicateId) return duplicateId;
    throw new Error(`Amazon-Tagesreport konnte nicht erstellt werden (HTTP ${res.status}). ${detail}`);
  }
  return String(data.reportId);
}

export async function createSponsoredProductsKeywordDailyReport(
  profileId: string,
  startDate: string,
  endDate: string
) {
  const connection = await getAmazonConnectionByProfileId(profileId);
  if (!connection?.refresh_token) throw new Error("Amazon-Profil nicht gefunden.");
  const accessToken = await getAmazonAccessToken(connection.refresh_token);
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  if (!clientId) throw new Error("Amazon LWA Client-ID fehlt.");

  const res = await fetch(`${ADS_API_URL}/reporting/reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/vnd.createasyncreportrequest.v3+json",
    },
    body: JSON.stringify({
      name: `BookForge SP daily keywords ${startDate} - ${endDate}`,
      startDate,
      endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["targeting"],
        columns: [
          "date","campaignId","campaignName","keywordId","keyword","matchType",
          "impressions","clicks","cost","purchases14d","sales14d","keywordBid"
        ],
        filters: [
          { field: "keywordType", values: ["BROAD","PHRASE","EXACT"] }
        ],
        reportTypeId: "spTargeting",
        timeUnit: "DAILY",
        format: "GZIP_JSON",
      },
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.reportId) {
    const detail = typeof data === "object" && data ? JSON.stringify(data).slice(0,700) : "";
    const duplicateId = typeof data?.detail === "string"
      ? data.detail.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
      : undefined;
    if (res.status === 425 && duplicateId) return duplicateId;
    throw new Error(`Amazon-Keyword-Report konnte nicht erstellt werden (HTTP ${res.status}). ${detail}`);
  }
  return String(data.reportId);
}

export async function getSponsoredProductsReport(profileId: string, reportId: string) {
  const connection = await getAmazonConnectionByProfileId(profileId);
  if (!connection?.refresh_token) throw new Error("Amazon-Profil nicht gefunden.");
  const accessToken = await getAmazonAccessToken(connection.refresh_token);
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  if (!clientId) throw new Error("Amazon LWA Client-ID fehlt.");

  const res = await fetch(`${ADS_API_URL}/reporting/reports/${encodeURIComponent(reportId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data === "object" && data ? JSON.stringify(data).slice(0,700) : "";
    throw new Error(`Amazon-Reportstatus konnte nicht geladen werden (HTTP ${res.status}). ${detail}`);
  }
  if (data.status !== "COMPLETED") return {status: data.status, rows: []};

  if (!data.url) throw new Error("Amazon-Report ist fertig, aber keine Download-URL wurde geliefert.");
  const fileRes = await fetch(data.url, {cache: "no-store"});
  if (!fileRes.ok) throw new Error(`Amazon-Report konnte nicht heruntergeladen werden (HTTP ${fileRes.status}).`);
  const buffer = await fileRes.arrayBuffer();
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  const parsed = JSON.parse(text);
  return {status: data.status, rows: Array.isArray(parsed) ? parsed : []};
}
