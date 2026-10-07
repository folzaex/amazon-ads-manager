import { NextRequest, NextResponse } from "next/server";
import { createSponsoredProductsCampaignReport } from "@/lib/amazonAds";

export const runtime = "nodejs";

function dates(range: string) {
  const end = new Date();
  const days = range === "TODAY" ? 0 : range === "7" ? 6 : 29;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return {
    startDate: start.toISOString().slice(0,10),
    endDate: end.toISOString().slice(0,10),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = String(body.profileId || "").trim();
    const range = String(body.range || "30");
    if (!profileId) return NextResponse.json({error:"profileId fehlt."},{status:400});
    if (!["TODAY","7","30"].includes(range)) return NextResponse.json({error:"Dieser Zeitraum wird derzeit nicht unterstützt."},{status:400});
    const {startDate,endDate}=dates(range);
    const reportId=await createSponsoredProductsCampaignReport(profileId,startDate,endDate);
    return NextResponse.json({reportId,startDate,endDate});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Unbekannter Fehler."},{status:500});
  }
}
