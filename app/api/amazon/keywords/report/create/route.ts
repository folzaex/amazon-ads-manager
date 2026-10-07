import { NextRequest, NextResponse } from "next/server";
import { createSponsoredProductsKeywordDailyReport } from "@/lib/amazonAds";

export const runtime = "nodejs";

function format(d: Date) { return d.toISOString().slice(0,10); }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = String(body.profileId || "").trim();
    if (!profileId) return NextResponse.json({error:"profileId fehlt."},{status:400});

    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 30);

    const reportId = await createSponsoredProductsKeywordDailyReport(
      profileId,
      format(start),
      format(end)
    );

    return NextResponse.json({reportId,startDate:format(start),endDate:format(end)});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Unbekannter Fehler."},{status:500});
  }
}
