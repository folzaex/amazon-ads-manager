import { NextRequest, NextResponse } from "next/server";
import { getSponsoredProductsReport } from "@/lib/amazonAds";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const profileId=req.nextUrl.searchParams.get("profileId")?.trim();
    const reportId=req.nextUrl.searchParams.get("reportId")?.trim();
    if (!profileId || !reportId) return NextResponse.json({error:"profileId und reportId fehlen."},{status:400});
    const result=await getSponsoredProductsReport(profileId,reportId);
    return NextResponse.json(result);
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Unbekannter Fehler."},{status:500});
  }
}
