import { NextRequest, NextResponse } from "next/server";
import { getSponsoredProductsReport } from "@/lib/amazonAds";

export const runtime = "nodejs";

function n(v:any) { return typeof v === "number" ? v : Number(v || 0); }

export async function GET(req: NextRequest) {
  try {
    const profileId=req.nextUrl.searchParams.get("profileId")?.trim();
    const reportIds=(req.nextUrl.searchParams.get("reportIds")||"").split(",").map(x=>x.trim()).filter(Boolean);
    if (!profileId || !reportIds.length) return NextResponse.json({error:"profileId und reportIds fehlen."},{status:400});

    const results=await Promise.all(reportIds.map(id=>getSponsoredProductsReport(profileId,id)));
    const pending=results.some(r=>r.status !== "COMPLETED");
    if (pending) return NextResponse.json({status:"PROCESSING",rows:[]});

    const byCampaign=new Map<string,any>();
    for (const result of results) {
      for (const row of result.rows) {
        const id=String(row.campaignId ?? "");
        if (!id) continue;
        const current=byCampaign.get(id) || {campaignId:id,campaignName:row.campaignName||"",impressions:0,clicks:0,cost:0,sales14d:0,purchases14d:0,unitsSoldClicks14d:0};
        current.impressions += n(row.impressions);
        current.clicks += n(row.clicks);
        current.cost += n(row.cost ?? row.spend);
        current.sales14d += n(row.sales14d);
        current.purchases14d += n(row.purchases14d);
        current.unitsSoldClicks14d += n(row.unitsSoldClicks14d);
        byCampaign.set(id,current);
      }
    }
    const rows=[...byCampaign.values()];
    const totals=rows.reduce((a,r)=>({
      impressions:a.impressions+r.impressions,clicks:a.clicks+r.clicks,cost:a.cost+r.cost,
      sales14d:a.sales14d+r.sales14d,purchases14d:a.purchases14d+r.purchases14d,
      unitsSoldClicks14d:a.unitsSoldClicks14d+r.unitsSoldClicks14d
    }),{impressions:0,clicks:0,cost:0,sales14d:0,purchases14d:0,unitsSoldClicks14d:0});
    const acos=totals.sales14d>0?(totals.cost/totals.sales14d)*100:0;
    const roas=totals.cost>0?totals.sales14d/totals.cost:0;
    return NextResponse.json({status:"COMPLETED",rows,totals:{...totals,acos,roas}});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Unbekannter Fehler."},{status:500});
  }
}
