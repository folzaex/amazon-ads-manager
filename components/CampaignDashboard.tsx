"use client";

import { useEffect, useState } from "react";

type Profile = {id:string; amazon_profile_id:string|null; profile_name:string|null; country_code:string|null};
type Campaign = {campaignId:string; name:string; state?:string; campaignType?:string; dailyBudget?:number; startDate?:string; endDate?:string};
type Metrics = {impressions:number; clicks:number; cost:number; sales14d:number; purchases14d:number; unitsSoldClicks14d:number; acos:number; roas:number};

type TopKeyword = {keyword:string; campaignName:string; cost:number; clicks:number; purchases14d:number};

export default function CampaignDashboard({profiles}:{profiles:Profile[]}) {
  const [profileId,setProfileId] = useState(() => profiles.find(p => p.country_code === "DE")?.amazon_profile_id ?? profiles[0]?.amazon_profile_id ?? "");
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [stateFilter,setStateFilter] = useState<"ALL"|"ENABLED"|"PAUSED">("ENABLED");
  const [dateRange,setDateRange] = useState<"TODAY"|"YESTERDAY"|"DAY_BEFORE_YESTERDAY"|"7"|"30">("TODAY");
  const [metrics,setMetrics] = useState<Metrics|null>(null);
  const [performanceUpdatedAt,setPerformanceUpdatedAt] = useState<number|null>(null);
  const [campaignMetrics,setCampaignMetrics] = useState<Record<string, any>>({});
  const [reportLoading,setReportLoading] = useState(false);
  const [reportError,setReportError] = useState("");
  const [sortBy,setSortBy] = useState<"cost"|"purchases14d"|"clicks"|"impressions">("cost");
  const [sortDirection,setSortDirection] = useState<"desc"|"asc">("desc");
  const [topKeywords,setTopKeywords] = useState<TopKeyword[]>([]);
  const [keywordLoading,setKeywordLoading] = useState(false);
  const [keywordError,setKeywordError] = useState("");

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

  function daysForRange(range: typeof dateRange) {
    if (range === "TODAY") return 1;
    if (range === "YESTERDAY") return 1;
    if (range === "DAY_BEFORE_YESTERDAY") return 1;
    if (range === "7") return 7;
    if (range === "30") return 30;
    return 30;
  }

  function endOffsetForRange(range: typeof dateRange) {
    if (range === "YESTERDAY") return 1;
    if (range === "DAY_BEFORE_YESTERDAY") return 2;
    return 0;
  }

  function aggregateDailyRows(rows:any[], range: typeof dateRange) {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - endOffsetForRange(range));
    const endKey = end.toISOString().slice(0,10);
    const days = daysForRange(range);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startKey = start.toISOString().slice(0,10);

    const byCampaign = new Map<string,any>();
    for (const row of rows) {
      const date = String(row.date ?? "");
      if (date < startKey || date > endKey) continue;
      const id = String(row.campaignId ?? "");
      if (!id) continue;
      const current = byCampaign.get(id) || {
        campaignId:id,campaignName:row.campaignName||"",impressions:0,clicks:0,cost:0,
        sales14d:0,purchases14d:0,unitsSoldClicks14d:0
      };
      current.impressions += Number(row.impressions || 0);
      current.clicks += Number(row.clicks || 0);
      current.cost += Number(row.cost ?? row.spend ?? 0);
      current.sales14d += Number(row.sales14d || 0);
      current.purchases14d += Number(row.purchases14d || 0);
      current.unitsSoldClicks14d += Number(row.unitsSoldClicks14d || 0);
      byCampaign.set(id,current);
    }

    const campaignRows = [...byCampaign.values()];
    const totals = campaignRows.reduce((a,r)=>({
      impressions:a.impressions+r.impressions,
      clicks:a.clicks+r.clicks,
      cost:a.cost+r.cost,
      sales14d:a.sales14d+r.sales14d,
      purchases14d:a.purchases14d+r.purchases14d,
      unitsSoldClicks14d:a.unitsSoldClicks14d+r.unitsSoldClicks14d
    }),{impressions:0,clicks:0,cost:0,sales14d:0,purchases14d:0,unitsSoldClicks14d:0});
    const acos = totals.sales14d > 0 ? (totals.cost / totals.sales14d) * 100 : 0;
    const roas = totals.cost > 0 ? totals.sales14d / totals.cost : 0;
    return {metrics:{...totals,acos,roas},campaignMetrics:Object.fromEntries(campaignRows.map(r=>[r.campaignId,r]))};
  }

  function aggregateKeywordRows(rows:any[], range: typeof dateRange) {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - endOffsetForRange(range));
    const endKey = end.toISOString().slice(0,10);
    const days = daysForRange(range);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startKey = start.toISOString().slice(0,10);

    const byKeyword = new Map<string,TopKeyword>();
    for (const row of rows) {
      const date = String(row.date ?? "");
      if (date < startKey || date > endKey) continue;
      const keyword = String(row.keyword ?? "").trim();
      if (!keyword) continue;
      const id = String(row.keywordId ?? keyword) + "|" + String(row.campaignId ?? "");
      const current = byKeyword.get(id) || {
        keyword,
        campaignName: String(row.campaignName ?? "Ohne Kampagne"),
        cost: 0,
        clicks: 0,
        purchases14d: 0,
        sales14d: 0,
        acos: 0
      };
      current.cost += Number(row.cost || 0);
      current.clicks += Number(row.clicks || 0);
      current.purchases14d += Number(row.purchases14d || 0);
      current.sales14d += Number(row.sales14d || 0);
      byKeyword.set(id,current);
    }

    return [...byKeyword.values()]
      .map(k => ({...k, acos: k.sales14d > 0 ? (k.cost / k.sales14d) * 100 : 0}))
      .sort((a,b) => b.cost - a.cost)
      .slice(0,3);
  }

  function applyCachedKeywordRows(rows:any[]) {
    setTopKeywords(aggregateKeywordRows(rows,dateRange));
  }

  function applyCachedDailyRows(rows:any[], savedAt?: number) {
    const result = aggregateDailyRows(rows,dateRange);
    setMetrics(result.metrics);
    setCampaignMetrics(result.campaignMetrics);
    if (savedAt) setPerformanceUpdatedAt(savedAt);
  }

  async function loadReport(force=false) {
    if (!profileId) return;
    const cacheKey = `amazon-ads-daily:${profileId}`;
    setReportError("");

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!force && cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.rows) && parsed.savedAt) {
          applyCachedDailyRows(parsed.rows, parsed.savedAt);
          if (Date.now() - parsed.savedAt < 10 * 60 * 1000) return;
        }
      }

      setReportLoading(true);
      const create = await fetch("/api/amazon/report/create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({profileId}), cache:"no-store"
      });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error || "Report konnte nicht erstellt werden.");

      let done = false;
      for (let attempt=0; attempt<12; attempt++) {
        const res = await fetch(`/api/amazon/report/status?profileId=${encodeURIComponent(profileId)}&reportId=${encodeURIComponent(created.reportId)}`,{cache:"no-store"});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reportstatus konnte nicht geladen werden.");
        if (data.status === "COMPLETED") {
          const rows = data.rows || [];
          localStorage.setItem(cacheKey, JSON.stringify({savedAt:Date.now(),rows}));
          applyCachedDailyRows(rows, Date.now());
          done=true;
          break;
        }
        await new Promise(r=>setTimeout(r,5000));
      }
      if (!done) setReportError("Amazon erstellt den 30-Tage-Report noch. Die bisherigen Kennzahlen bleiben sichtbar.");
    } catch(e) {
      setReportError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setReportLoading(false);
    }
  }
  async function loadKeywordReport(force=false) {
    if (!profileId) return;
    const cacheKey = `amazon-ads-keywords-v1:${profileId}`;
    setKeywordError("");
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!force && cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.rows) && parsed.savedAt) {
          applyCachedKeywordRows(parsed.rows);
          if (Date.now() - parsed.savedAt < 10 * 60 * 1000) return;
        }
      }

      setKeywordLoading(true);
      const create = await fetch("/api/amazon/keywords/report/create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({profileId}), cache:"no-store"
      });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error || "Keyword-Report konnte nicht erstellt werden.");

      let done = false;
      for (let attempt=0; attempt<12; attempt++) {
        const res = await fetch(`/api/amazon/report/status?profileId=${encodeURIComponent(profileId)}&reportId=${encodeURIComponent(created.reportId)}`,{cache:"no-store"});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Keyword-Reportstatus konnte nicht geladen werden.");
        if (data.status === "COMPLETED") {
          const rows = data.rows || [];
          localStorage.setItem(cacheKey, JSON.stringify({savedAt:Date.now(),rows}));
          applyCachedKeywordRows(rows);
          done=true;
          break;
        }
        await new Promise(r=>setTimeout(r,5000));
      }
      if (!done) setKeywordError("Amazon erstellt den Keyword-Report noch.");
    } catch(e) {
      setKeywordError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setKeywordLoading(false);
    }
  }

  useEffect(() => { if (profileId) loadReport(false); }, [profileId]);
  useEffect(() => { if (profileId) loadKeywordReport(false); }, [profileId]);
  useEffect(() => {
    const cacheKey = `amazon-ads-daily:${profileId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      const parsed = cached ? JSON.parse(cached) : null;
      if (Array.isArray(parsed?.rows)) applyCachedDailyRows(parsed.rows, parsed.savedAt);
      const keywordCached = localStorage.getItem(`amazon-ads-keywords-v1:${profileId}`);
      const keywordParsed = keywordCached ? JSON.parse(keywordCached) : null;
      if (Array.isArray(keywordParsed?.rows)) applyCachedKeywordRows(keywordParsed.rows);
    } catch {}
  }, [dateRange, profileId]);

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
      <button className={dateRange === "YESTERDAY" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("YESTERDAY")}>Gestern</button>
      <button className={dateRange === "DAY_BEFORE_YESTERDAY" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("DAY_BEFORE_YESTERDAY")}>Vorgestern</button>
      <button className={dateRange === "7" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("7")}>7 Tage</button>
      <button className={dateRange === "30" ? "filter-btn active" : "filter-btn"} onClick={() => setDateRange("30")}>30 Tage</button>

    </div>
    </div>

    <div className="metrics-head">
      <div>
        <strong>Performance</strong>
        {performanceUpdatedAt && (
          <div className="performance-timestamp">
            Datenstand: {new Date(performanceUpdatedAt).toLocaleString("de-DE", {
              day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"
            })} Uhr
          </div>
        )}
      </div>
      <button className="filter-btn" onClick={()=>loadReport(true)} disabled={reportLoading}>
        {reportLoading ? (metrics ? "Performance wird aktualisiert..." : "Performance wird geladen...") : "Performance aktualisieren"}
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

    {keywordError && <div className="status warn"><strong>Keyword-Hinweis</strong><br/>{keywordError}</div>}
    <div className="top-keywords">
      <div className="top-keywords-head">
        <strong>Top 3 Keywords nach Kosten</strong>
        <button className="filter-btn" onClick={()=>loadKeywordReport(true)} disabled={keywordLoading}>
          {keywordLoading ? "Keywords werden geladen..." : "Keywords aktualisieren"}
        </button>
      </div>
      {topKeywords.length > 0 ? (
        <div className="keyword-table-wrap">
          <table className="keyword-table">
            <thead><tr><th>Keyword</th><th>Kampagne</th><th>Kosten</th><th>Klicks</th><th>Bestellungen</th><th>ACOS</th></tr></thead>
            <tbody>
              {topKeywords.map((k,i)=><tr key={`${k.campaignName}-${k.keyword}-${i}`}>
                <td>{k.keyword}</td><td>{k.campaignName}</td><td>{k.cost.toFixed(2)} €</td><td>{k.clicks}</td><td>{k.purchases14d}</td><td>{k.acos.toFixed(1)} %</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      ) : !keywordLoading ? <div className="keyword-empty">Keine Keyword-Daten für den ausgewählten Zeitraum.</div> : null}
    </div>

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
