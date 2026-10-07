"use client";

import { useEffect, useState } from "react";

type Profile = {id:string; amazon_profile_id:string|null; profile_name:string|null; country_code:string|null};
type Campaign = {campaignId:string; name:string; state?:string; campaignType?:string; dailyBudget?:number; startDate?:string; endDate?:string};
type Metrics = {impressions:number; clicks:number; cost:number; sales14d:number; purchases14d:number; unitsSoldClicks14d:number; acos:number; roas:number};

export default function CampaignDashboard({profiles}:{profiles:Profile[]}) {
  const [profileId,setProfileId] = useState(() => profiles.find(p => p.country_code === "DE")?.amazon_profile_id ?? profiles[0]?.amazon_profile_id ?? "");
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [stateFilter,setStateFilter] = useState<"ALL"|"ENABLED"|"PAUSED">("ENABLED");
  const [dateRange,setDateRange] = useState<"TODAY"|"7"|"30"|"90">("TODAY");
  const [metrics,setMetrics] = useState<Metrics|null>(null);
  const [campaignMetrics,setCampaignMetrics] = useState<Record<string, any>>({});
  const [reportLoading,setReportLoading] = useState(false);
  const [reportError,setReportError] = useState("");
  const [sortBy,setSortBy] = useState<"cost"|"purchases14d"|"clicks"|"impressions">("cost");
  const [sortDirection,setSortDirection] = useState<"desc"|"asc">("desc");

  async function loadCampaigns(id=profileId) {
    if (!id) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/amazon/campaigns?profileId=${encodeURIComponent(id)}`,{cache:"no-store"});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kampagnen konnten nicht geladen werden.");
      setCampaigns(data.campaigns || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler.");
      setCampaigns([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (profileId) loadCampaigns(profileId); }, [profileId]);

  async function loadReport(range=dateRange) {
    if (!profileId) return;
    setReportLoading(true); setReportError("");
    setMetrics(null); setCampaignMetrics({});
    try {
      const create = await fetch("/api/amazon/report/create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({profileId,range}), cache:"no-store"
      });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error || "Report konnte nicht erstellt werden.");
      const ids = (created.reportIds || []).join(",");
      let done = false;
      for (let attempt=0; attempt<12; attempt++) {
        const res = await fetch(`/api/amazon/report/status?profileId=${encodeURIComponent(profileId)}&reportIds=${encodeURIComponent(ids)}`,{cache:"no-store"});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reportstatus konnte nicht geladen werden.");
        if (data.status === "COMPLETED") {
          setMetrics(data.totals);
          const map:Record<string,any>={};
          for (const row of data.rows || []) map[row.campaignId]=row;
          setCampaignMetrics(map);
          done=true; break;
        }
        await new Promise(r=>setTimeout(r,5000));
      }
      if (!done) setReportError("Amazon erstellt den Report noch. Bitte später erneut auf „Kampagnen aktualisieren“ klicken.");
    } catch(e) {
      setReportError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally { setReportLoading(false); }
  }

  useEffect(() => { if (profileId) loadReport(dateRange); }, [profileId, dateRange]);

  const selected = profiles.find(p => p.amazon_profile_id === profileId);
  const filteredCampaigns = stateFilter === "ALL" ? campaigns : campaigns.filter(c => c.state === stateFilter);
  const sortedCampaigns = [...filteredCampaigns].sort((a,b) => {
    const av = Number(campaignMetrics[a.campaignId]?.[sortBy] ?? 0);
    const bv = Number(campaignMetrics[b.campaignId]?.[sortBy] ?? 0);
    return sortDirection === "asc" ? av - bv : bv - av;
  });

  return <section className="dashboard">
    <div className="toolbar">
      <div>
        <label htmlFor="profile">Amazon-Ads-Profil</label>
        <select id="profile" value={profileId} onChange={e=>setProfileId(e.target.value)}>
          {profiles.map(p=><option key={p.id} value={p.amazon_profile_id ?? ""}>
            {p.country_code ? p.country_code+" – " : ""}{p.profile_name || "Profil"} ({p.amazon_profile_id})
          </option>)}
        </select>
      </div>
      <button className="btn" onClick={()=>loadCampaigns()} disabled={loading}>
        {loading ? "Lade..." : "Kampagnen aktualisieren"}
      </button>
    </div>

    <div className="filter-row">
    <div className="campaign-filter">
      <span className="filter-label">Kampagnenstatus</span>
      <button className={stateFilter === "ALL" ? "filter-btn active" : "filter-btn"} onClick={() => setStateFilter("ALL")}>Alle</button>
      <button className={stateFilter === "ENABLED" ? "filter-btn active" : "filter-btn"} onClick={() => setStateFilter("ENABLED")}>Aktiv</button>
      <button className={stateFilter === "PAUSED" ? "filter-btn active" : "filter-btn"} onClick={() => setStateFilter("PAUSED")}>Pausiert</button>
    </div>
    <div className="campaign-filter">
      <span className="filter-label">Zeitraum</span>
      <button className={dateRange === "TODAY" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("TODAY")}>Heute</button>
      <button className={dateRange === "7" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("7")}>7 Tage</button>
      <button className={dateRange === "30" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("30")}>30 Tage</button>
      <button className={dateRange === "90" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("90")}>90 Tage</button>
    </div>
    </div>

    <div className="metrics-head">
      <strong>Performance</strong>
      <button className="filter-btn" onClick={()=>loadReport()} disabled={reportLoading}>
        {reportLoading ? "Report wird geladen..." : "Performance aktualisieren"}
      </button>
    </div>
    {reportError && <div className="status warn"><strong>Hinweis</strong><br/>{reportError}</div>}
    {metrics && <div className="metrics-grid">
      <div className="metric-card"><span>Ausgaben</span><strong>{metrics.cost.toFixed(2)} €</strong></div>
      <div className="metric-card"><span>Umsatz</span><strong>{metrics.sales14d.toFixed(2)} €</strong></div>
      <div className="metric-card"><span>Bestellungen</span><strong>{metrics.purchases14d}</strong></div>
      <div className="metric-card"><span>Klicks</span><strong>{metrics.clicks.toLocaleString("de-DE")}</strong></div>
      <div className="metric-card"><span>Impressionen</span><strong>{metrics.impressions.toLocaleString("de-DE")}</strong></div>
      <div className="metric-card"><span>ACOS</span><strong>{metrics.acos.toFixed(1)} %</strong></div>
      <div className="metric-card"><span>ROAS</span><strong>{metrics.roas.toFixed(2)}</strong></div>
    </div>}

    {selected && <div className="profile-note">Ausgewähltes Profil: <strong>{selected.country_code || "–"}</strong></div>}
    {error && <div className="status error"><strong>Fehler</strong><br/>{error}</div>}

    {!loading && !error && <div className="campaign-count"><strong>{filteredCampaigns.length}</strong> von {campaigns.length} Kampagnen angezeigt</div>}

    <div className="sort-row">
      <label htmlFor="sort">Sortieren nach</label>
      <select id="sort" value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}>
        <option value="cost">Kosten</option>
        <option value="purchases14d">Bestellungen</option>
        <option value="clicks">Klicks</option>
        <option value="impressions">Impressionen</option>
      </select>
      <button className={sortDirection === "desc" ? "filter-btn active" : "filter-btn"} onClick={()=>setSortDirection("desc")}>↓ Absteigend</button>
      <button className={sortDirection === "asc" ? "filter-btn active" : "filter-btn"} onClick={()=>setSortDirection("asc")}>↑ Aufsteigend</button>
    </div>

    <div className="campaigns">
      {sortedCampaigns.map(c=><div className="campaign" key={c.campaignId}>
        <div className="campaign-main">
          <strong>{c.name}</strong>
          <span className={c.state === "ENABLED" ? "badge on" : "badge"}>{c.state === "ENABLED" ? "Aktiv" : "Pausiert"}</span>
        </div>
        <div className="campaign-meta">
          {campaignMetrics[c.campaignId] && <span>
            {campaignMetrics[c.campaignId].cost.toFixed(2)} € Kosten · {campaignMetrics[c.campaignId].purchases14d} Bestellungen · {campaignMetrics[c.campaignId].clicks} Klicks · {Number(campaignMetrics[c.campaignId].impressions).toLocaleString("de-DE")} Impressionen · ACOS {campaignMetrics[c.campaignId].sales14d > 0 ? ((campaignMetrics[c.campaignId].cost / campaignMetrics[c.campaignId].sales14d) * 100).toFixed(1) : "0.0"} %
          </span>}
        </div>
      </div>)}
    </div>
  </section>;
}
