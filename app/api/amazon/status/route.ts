import { NextResponse } from "next/server";
import { getAmazonConnections } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const connections = await getAmazonConnections();
    return NextResponse.json({ connected: connections.length > 0, profiles: connections });
  } catch {
    return NextResponse.json({ connected: false, profiles: [], error: "Verbindungsstatus konnte nicht geladen werden." }, { status: 500 });
  }
}
