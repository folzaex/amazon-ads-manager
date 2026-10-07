"use client";

import { useEffect, useState } from "react";

type Profile = {id:string; amazon_profile_id:string|null; profile_name:string|null; country_code:string|null};
type Campaign = {campaignId:string; name:string; state?:string; campaignType?:string; dailyBudget?:number; startDate?:string; endDate?:string};

export default function CampaignDashboard({profiles}:{profiles:Profile[]}) {
  const [profileId,setProfileId] = useState(() => profiles.find(p => p.country_code === "DE")?.amazon_profile_id ?? profiles[0]?.amazon_profile_id ?? "");
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [stateFilter,setStateFilter] = useState<"ALL"|"ENABLED"|"PAUSED">("ENABLED");
  const [dateRange,setDateRange] = useState<"TODAY"|"7"|"30"|"90"|"CUSTOM">("30");

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

  const selected = profiles.find(p => p.amazon_profile_id === profileId);
  const filteredCampaigns = stateFilter === "ALL" ? campaigns : campaigns.filter(c => c.state === stateFilter);

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
      <button className={dateRange === "CUSTOM" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("CUSTOM")}>Benutzerdefiniert</button>
    </div>
    </div>

    {selected && <div className="profile-note">Ausgewähltes Profil: <strong>{selected.country_code || "–"}</strong></div>}
    {error && <div className="status error"><strong>Fehler</strong><br/>{error}</div>}

    {!loading && !error && <div className="campaign-count"><strong>{filteredCampaigns.length}</strong> von {campaigns.length} Kampagnen angezeigt</div>}

    <div className="campaigns">
      {filteredCampaigns.map(c=><div className="campaign" key={c.campaignId}>
        <div className="campaign-main">
          <strong>{c.name}</strong>
          <span className={c.state === "ENABLED" ? "badge on" : "badge"}>{c.state === "ENABLED" ? "Aktiv" : "Pausiert"}</span>
        </div>
        <div className="campaign-meta">
          <span>{c.campaignType || "Sponsored Products"}</span>
          <span>{typeof c.dailyBudget === "number" ? `Tagesbudget: ${c.dailyBudget.toFixed(2)} €` : "Tagesbudget –"}</span>
          <span>{c.startDate ? `Start: ${c.startDate}` : ""}</span>
        </div>
      </div>)}
    </div>
  </section>;
}
