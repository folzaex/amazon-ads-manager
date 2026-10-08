import { NextRequest, NextResponse } from "next/server";
import { getSponsoredProductsReport } from "@/lib/amazonAds";

function n(v:any) { return typeof v === "number" ? v : Number(v || 0); }

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const profileId=req.nextUrl.searchParams.get("profileId")?.trim();
    const reportId=req.nextUrl.searchParams.get("reportId")?.trim();
    if (!profileId || !reportId) return NextResponse.json({error:"profileId und reportId fehlen."},{status:400});

    const result=await getSponsoredProductsReport(profileId,reportId);
    if (result.status !== "COMPLETED") {
      return NextResponse.json({
        status: result.status || "PROCESSING",
        failureReason: result.failureReason || null,
        rows:[]
      });
    }

    return NextResponse.json({status:"COMPLETED",rows:result.rows});
  } catch(e) {
    const err = e as Error & {status?: number};
    return NextResponse.json({error:err.message || "Unbekannter Fehler."},{status:err.status || 500});
  }
}
