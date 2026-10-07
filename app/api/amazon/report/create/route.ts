import { NextRequest, NextResponse } from "next/server";
import { createSponsoredProductsCampaignReport } from "@/lib/amazonAds";

export const runtime = "nodejs";

function format(d: Date) { return d.toISOString().slice(0,10); }

function ranges(range: string) {
  const end = new Date();
  const totalDays = range === "TODAY" || range === "YESTERDAY" || range === "DAY_BEFORE_YESTERDAY" ? 1 : range === "7" ? 7 : range === "30" ? 30 : 90;
  const offsetDays = range === "YESTERDAY" ? 1 : range === "DAY_BEFORE_YESTERDAY" ? 2 : 0;
  end.setUTCDate(end.getUTCDate() - offsetDays);
  const result: {startDate:string;endDate:string}[] = [];
  let cursor = new Date(end);
  let remaining = totalDays;
  while (remaining > 0) {
    const chunk = Math.min(31, remaining);
    const start = new Date(cursor);
    start.setUTCDate(start.getUTCDate() - (chunk - 1));
    result.push({startDate:format(start),endDate:format(cursor)});
    remaining -= chunk;
    cursor = new Date(start);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return result.reverse();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = String(body.profileId || "").trim();
    const range = String(body.range || "30");
    if (!profileId) return NextResponse.json({error:"profileId fehlt."},{status:400});
    if (!["TODAY","YESTERDAY","DAY_BEFORE_YESTERDAY","7","30","90"].includes(range)) return NextResponse.json({error:"Ungültiger Zeitraum."},{status:400});
    const periods = ranges(range);
    const reportIds = [];
    for (const period of periods) {
      reportIds.push(await createSponsoredProductsCampaignReport(profileId,period.startDate,period.endDate));
    }
    return NextResponse.json({reportIds,periods});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Unbekannter Fehler."},{status:500});
  }
}
