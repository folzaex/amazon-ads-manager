import { NextRequest, NextResponse } from "next/server";
import { createSponsoredProductsCampaignDailyReport } from "@/lib/amazonAds";

export const runtime = "nodejs";

function format(d: Date) { return d.toISOString().slice(0,10); }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = String(body.profileId || "").trim();
    if (!profileId) return NextResponse.json({error:"profileId fehlt."},{status:400});

    const end = new Date();
    const start = new Date(end);
    // Amazon erlaubt maximal 31 Tage pro Report.
    start.setUTCDate(start.getUTCDate() - 30);

    const startDate = format(start);
    const endDate = format(end);
    const reportId = await createSponsoredProductsCampaignDailyReport(profileId,startDate,endDate);

    return NextResponse.json({reportId,startDate,endDate});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Unbekannter Fehler."},{status:500});
  }
}
