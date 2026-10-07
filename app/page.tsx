import { getAmazonConnections } from "@/lib/supabaseAdmin";
import CampaignDashboard from "@/components/CampaignDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let profiles: Awaited<ReturnType<typeof getAmazonConnections>> = [];
  let dbError = false;

  try { profiles = await getAmazonConnections(); } catch { dbError = true; }

  return <main>
    <div className="card">
      <h1>Amazon Ads Manager</h1>
      {dbError ? (
        <div className="status warn"><strong>Supabase-Verbindung</strong><br/>Der Verbindungsstatus konnte noch nicht geladen werden.</div>
      ) : profiles.length > 0 ? (
        <>
          <div className="status ok"><strong>Amazon Ads verbunden ✓</strong><br/>{profiles.length} Amazon-Ads-Profile gefunden.</div>
          <CampaignDashboard profiles={profiles} />
        </>
      ) : (
        <div className="status warn"><strong>Amazon Ads Verbindung</strong><br/>Noch nicht verbunden.</div>
      )}
      <a className="btn" href="/api/amazon/authorize">{profiles.length ? "Amazon Ads erneut verbinden" : "Mit Amazon Ads verbinden"}</a>
      <p className="small">Geheime Zugangsdaten und Amazon-Refresh-Tokens werden ausschließlich serverseitig verarbeitet.</p>
    </div>
  </main>;
}
