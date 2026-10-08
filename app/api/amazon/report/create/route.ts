import { NextRequest, NextResponse } from "next/server";
import { createSponsoredProductsCampaignDailyReport } from "@/lib/amazonAds";

export const runtime = "nodejs";

function format(d: Date) { return d.toISOString().slice(0,10); }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = String(body.profileId || "").trim();
    const days = Number(body.days) === 1 ? 1 : 7;
    if (!profileId) return NextResponse.json({error:"profileId fehlt."},{status:400});

    const end = new Date();
    const start = new Date(end);
    // Für schnellere Reports laden wir nur die letzten 7 Tage.
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const startDate = format(start);
    const endDate = format(end);
    const reportId = await createSponsoredProductsCampaignDailyReport(profileId,startDate,endDate);

    return NextResponse.json({reportId,startDate,endDate});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Unbekannter Fehler."},{status:500});
  }
}
