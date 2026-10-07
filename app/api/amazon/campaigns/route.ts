import { NextRequest, NextResponse } from "next/server";
import { getSponsoredProductsCampaigns } from "@/lib/amazonAds";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId")?.trim();
  if (!profileId) return NextResponse.json({error:"profileId fehlt."},{status:400});

  try {
    const campaigns = await getSponsoredProductsCampaigns(profileId);
    return NextResponse.json({campaigns});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({error:message},{status:500});
  }
}
