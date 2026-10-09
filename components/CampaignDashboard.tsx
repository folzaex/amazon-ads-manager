"use client";

import { useEffect, useState } from "react";

type Profile = {id:string; amazon_profile_id:string|null; profile_name:string|null; country_code:string|null};
type Campaign = {campaignId:string; name:string; state?:string; campaignType?:string; dailyBudget?:number; startDate?:string; endDate?:string};
type Metrics = {impressions:number; clicks:number; cost:number; sales14d:number; purchases14d:number; unitsSoldClicks14d:number; acos:number; roas:number};

type TopKeyword = {keyword:string; campaignId:string; campaignName:string; matchType:string; bid:number; cost:number; clicks:number; purchases14d:number};
type ReportHistoryItem = {
  id:string;
  reportId:string;
  days:number;
  requestedAt:number;
  completedAt?:number;
  status:"PROCESSING"|"COMPLETED"|"FAILED";
  rows?:any[];
};

export default function CampaignDashboard({profiles}:{profiles:Profile[]}) {
  const [profileId,setProfileId] = useState(() => profiles.find(p => p.country_code === "DE")?.amazon_profile_id ?? profiles[0]?.amazon_profile_id ?? "");
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [stateFilter,setStateFilter] = useState<"ALL"|"ENABLED"|"PAUSED">("ENABLED");
  const [dateRange,setDateRange] = useState<"TODAY"|"YESTERDAY"|"DAY_BEFORE_YESTERDAY"|"7">("TODAY");
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
  const [keywordRows,setKeywordRows] = useState<TopKeyword[]>([]);
  const [keywordUpdatedAt,setKeywordUpdatedAt] = useState<number|null>(null);
  const [performanceHistory,setPerformanceHistory] = useState<ReportHistoryItem[]>([]);
  const [keywordHistory,setKeywordHistory] = useState<ReportHistoryItem[]>([]);
  const [selectedPerformanceReport,setSelectedPerformanceReport] = useState("");
  const [selectedKeywordReport,setSelectedKeywordReport] = useState("");
  const [searchTermsOpen,setSearchTermsOpen] = useState(false);
  const [searchTermsLoading,setSearchTermsLoading] = useState(false);
  const [searchTermsError,setSearchTermsError] = useState("");
  const [searchTermsReportId,setSearchTermsReportId] = useState("");
  const [searchTermsStatus,setSearchTermsStatus] = useState<"NONE"|"PROCESSING"|"COMPLETED"|"FAILED">("NONE");
  const [searchTermsRows,setSearchTermsRows] = useState<any[]>([]);

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
    return 7;
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
        campaignId: String(row.campaignId ?? ""),
        campaignName: String(row.campaignName ?? "Ohne Kampagne"),
        matchType: String(row.matchType ?? ""),
        bid: Number(row.keywordBid ?? 0),
        cost: 0,
        clicks: 0,
        purchases14d: 0
      };
      current.bid = Number(row.keywordBid ?? current.bid ?? 0);
      current.cost += Number(row.cost || 0);
      current.clicks += Number(row.clicks || 0);
      current.purchases14d += Number(row.purchases14d || 0);
      byKeyword.set(id,current);
    }

    return [...byKeyword.values()]
      .sort((a,b) => b.cost - a.cost)
      .slice(0,3);
  }

  function applyCachedKeywordRows(rows:any[], savedAt?: number, range: typeof dateRange = dateRange) {
    if (savedAt) setKeywordUpdatedAt(savedAt);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - endOffsetForRange(range));
    const endKey = end.toISOString().slice(0,10);
    const days = daysForRange(range);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startKey = start.toISOString().slice(0,10);
    const filtered = rows.filter((row:any) => {
      const date = String(row.date ?? "");
      return date >= startKey && date <= endKey && String(row.keyword ?? "").trim();
    });
    const all = aggregateKeywordRows(filtered, range);
    // aggregateKeywordRows already limits to the global top 3, so build the full
    // per-campaign list separately for campaign cards.
    const byKeyword = new Map<string,TopKeyword>();
    for (const row of filtered) {
      const keyword = String(row.keyword ?? "").trim();
      const campaignId = String(row.campaignId ?? "");
      if (!keyword || !campaignId) continue;
      const id = String(row.keywordId ?? keyword) + "|" + campaignId;
      const current = byKeyword.get(id) || {
        keyword, campaignId,
        campaignName: String(row.campaignName ?? "Ohne Kampagne"),
        matchType: String(row.matchType ?? ""),
        bid: Number(row.keywordBid ?? 0),
        cost: 0, clicks: 0, purchases14d: 0
      };
      current.cost += Number(row.cost || 0);
      current.clicks += Number(row.clicks || 0);
      current.purchases14d += Number(row.purchases14d || 0);
      byKeyword.set(id,current);
    }
    setTopKeywords(all);
    setKeywordRows([...byKeyword.values()]);
  }

  function getCampaignTopKeywords(campaignId:string) {
    return keywordRows
      .filter(k => k.campaignId === campaignId)
      .sort((a,b) => b.cost - a.cost)
      .slice(0,3);
  }

  function applyCachedDailyRows(rows:any[], savedAt?: number, range: typeof dateRange = dateRange) {
    const result = aggregateDailyRows(rows,range);
    setMetrics(result.metrics);
    setCampaignMetrics(result.campaignMetrics);
    if (savedAt) setPerformanceUpdatedAt(savedAt);
  }

  function historyKey(type:"performance"|"keywords") {
    return `amazon-ads-history:v1:${type}:${profileId}`;
  }

  function readHistory(type:"performance"|"keywords") {
    try {
      const raw=localStorage.getItem(historyKey(type));
      const parsed=raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed as ReportHistoryItem[] : [];
    } catch { return []; }
  }

  function writeHistory(type:"performance"|"keywords", items:ReportHistoryItem[]) {
    const trimmed=items.slice(0,10);
    localStorage.setItem(historyKey(type),JSON.stringify(trimmed));
    if (type==="performance") setPerformanceHistory(trimmed);
    else setKeywordHistory(trimmed);
  }

  function addPendingHistory(type:"performance"|"keywords", reportId:string, days:number) {
    const item:ReportHistoryItem={id:`${reportId}-${Date.now()}`,reportId,days,requestedAt:Date.now(),status:"PROCESSING"};
    writeHistory(type,[item,...readHistory(type).filter(x=>x.reportId!==reportId)]);
    return item;
  }

  function updateHistory(type:"performance"|"keywords", reportId:string, patch:Partial<ReportHistoryItem>) {
    writeHistory(type,readHistory(type).map(x=>x.reportId===reportId?{...x,...patch}:x));
  }

  function applyPerformanceHistory(item:ReportHistoryItem, range:typeof dateRange = dateRange) {
    if (!item.rows) return;
    applyCachedDailyRows(item.rows,item.completedAt || item.requestedAt,range);
  }

  function applyKeywordHistory(item:ReportHistoryItem, range:typeof dateRange = dateRange) {
    if (!item.rows) return;
    applyCachedKeywordRows(item.rows,item.completedAt || item.requestedAt,range);
  }

  async function checkPerformanceReport(item:ReportHistoryItem, range:typeof dateRange = dateRange) {
    setReportError("");
    try {
      const res=await fetch(`/api/amazon/report/status?profileId=${encodeURIComponent(profileId)}&reportId=${encodeURIComponent(item.reportId)}`,{cache:"no-store"});
      const data=await res.json();
      if (!res.ok) throw new Error(data.error || "Reportstatus konnte nicht geladen werden.");
      const status=String(data.status||"PROCESSING").toUpperCase();
      if (status==="COMPLETED") {
        const rows=data.rows||[];
        const completedAt=Date.now();
        updateHistory("performance",item.reportId,{status:"COMPLETED",completedAt,rows});
        applyCachedDailyRows(rows,completedAt,range);
        setSelectedPerformanceReport(item.reportId);
        return true;
      }
      if (["FAILED","FAILURE","ERROR"].includes(status)) {
        updateHistory("performance",item.reportId,{status:"FAILED"});
        throw new Error(`Amazon-Report fehlgeschlagen (Status: ${status}).`);
      }
      updateHistory("performance",item.reportId,{status:"PROCESSING"});
      setReportError("Der Report wird bei Amazon noch verarbeitet. Du kannst später erneut auf „Status prüfen“ klicken.");
      return false;
    } catch(e) {
      setReportError(e instanceof Error ? e.message : "Unbekannter Fehler.");
      return false;
    }
  }

  async function checkKeywordReport(item:ReportHistoryItem, range:typeof dateRange = dateRange) {
    setKeywordError("");
    try {
      const res=await fetch(`/api/amazon/report/status?profileId=${encodeURIComponent(profileId)}&reportId=${encodeURIComponent(item.reportId)}`,{cache:"no-store"});
      const data=await res.json();
      if (!res.ok) throw new Error(data.error || "Keyword-Reportstatus konnte nicht geladen werden.");
      const status=String(data.status||"PROCESSING").toUpperCase();
      if (status==="COMPLETED") {
        const rows=data.rows||[];
        const completedAt=Date.now();
        updateHistory("keywords",item.reportId,{status:"COMPLETED",completedAt,rows});
        applyCachedKeywordRows(rows,completedAt,range);
        setSelectedKeywordReport(item.reportId);
        return true;
      }
      if (["FAILED","FAILURE","ERROR"].includes(status)) {
        updateHistory("keywords",item.reportId,{status:"FAILED"});
        throw new Error(`Amazon-Keyword-Report fehlgeschlagen (Status: ${status}).`);
      }
      updateHistory("keywords",item.reportId,{status:"PROCESSING"});
      setKeywordError("Der Keyword-Report wird bei Amazon noch verarbeitet. Du kannst später erneut auf „Status prüfen“ klicken.");
      return false;
    } catch(e) {
      setKeywordError(e instanceof Error ? e.message : "Unbekannter Fehler.");
      return false;
    }
  }

  async function loadReport(force=false, days=7, range:typeof dateRange = dateRange):Promise<boolean> {
    if (!profileId) return false;
    setReportError(""); setReportLoading(true);
    try {
      let item=readHistory("performance").find(x=>x.status==="PROCESSING" && x.days===days);
      if (!item) {
        const create=await fetch("/api/amazon/report/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId,days}),cache:"no-store"});
        const created=await create.json();
        if (!create.ok) throw new Error(created.error||"Report konnte nicht erstellt werden.");
        const reportId=String(created.reportId||"");
        if (!reportId) throw new Error("Amazon hat keine Report-ID zurückgegeben.");
        item=addPendingHistory("performance",reportId,days);
      }
      setSelectedPerformanceReport(item.reportId);
      await checkPerformanceReport(item,range);
      return true;
    } catch(e) {
      setReportError(e instanceof Error ? e.message : "Unbekannter Fehler.");
      return false;
    } finally { setReportLoading(false); }
  }

  async function loadKeywordReport(force=false, days=7, range:typeof dateRange = dateRange):Promise<boolean> {
    if (!profileId) return false;
    setKeywordError(""); setKeywordLoading(true);
    try {
      let item=readHistory("keywords").find(x=>x.status==="PROCESSING" && x.days===days);
      if (!item) {
        const create=await fetch("/api/amazon/keywords/report/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId,days}),cache:"no-store"});
        const created=await create.json();
        if (!create.ok) throw new Error(created.error||"Keyword-Report konnte nicht erstellt werden.");
        const reportId=String(created.reportId||"");
        if (!reportId) throw new Error("Amazon hat keine Keyword-Report-ID zurückgegeben.");
        item=addPendingHistory("keywords",reportId,days);
      }
      setSelectedKeywordReport(item.reportId);
      await checkKeywordReport(item,range);
      return true;
    } catch(e) {
      setKeywordError(e instanceof Error ? e.message : "Unbekannter Fehler.");
      return false;
    } finally { setKeywordLoading(false); }
  }

  function loadHistories() {
    const p=readHistory("performance");
    const k=readHistory("keywords");
    setPerformanceHistory(p); setKeywordHistory(k);
    // Immer den neuesten gespeicherten Report auswählen – auch wenn er noch PROCESSING ist.
    // Sonst zeigt das Select zwar "wird verarbeitet", aber selected...Report bleibt leer
    // und der zugehörige "Status prüfen"-Button kann nicht gerendert werden.
    const pSelected=p.find(x=>x.status==="COMPLETED") || p[0];
    const kSelected=k.find(x=>x.status==="COMPLETED") || k[0];
    if (pSelected) {
      setSelectedPerformanceReport(pSelected.reportId);
      if (pSelected.status==="COMPLETED") applyPerformanceHistory(pSelected);
    }
    if (kSelected) {
      setSelectedKeywordReport(kSelected.reportId);
      if (kSelected.status==="COMPLETED") applyKeywordHistory(kSelected);
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`amazon-ads-search-terms:v1:${profileId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSearchTermsReportId(String(parsed.reportId || ""));
        setSearchTermsStatus(parsed.status || "NONE");
        setSearchTermsRows(Array.isArray(parsed.rows) ? parsed.rows : []);
      } else {
        setSearchTermsReportId("");
        setSearchTermsStatus("NONE");
        setSearchTermsRows([]);
      }
    } catch {}
  }, [profileId]);

  function saveSearchTermsState(patch:Record<string,any>) {
    const next = {
      reportId: searchTermsReportId,
      status: searchTermsStatus,
      rows: searchTermsRows,
      ...patch
    };
    setSearchTermsReportId(next.reportId);
    setSearchTermsStatus(next.status);
    setSearchTermsRows(next.rows);
    try { localStorage.setItem(`amazon-ads-search-terms:v1:${profileId}`, JSON.stringify(next)); } catch {}
  }

  async function requestSearchTermsReport() {
    setSearchTermsLoading(true); setSearchTermsError("");
    try {
      const res = await fetch("/api/amazon/search-terms/report/create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({profileId}), cache:"no-store"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suchbegriffsreport konnte nicht angefordert werden.");
      saveSearchTermsState({reportId:String(data.reportId),status:"PROCESSING",rows:[]});
      await checkSearchTermsReport(String(data.reportId));
    } catch(e) {
      setSearchTermsError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally { setSearchTermsLoading(false); }
  }

  async function checkSearchTermsReport(id=searchTermsReportId) {
    if (!id) return;
    setSearchTermsLoading(true); setSearchTermsError("");
    try {
      const res = await fetch(`/api/amazon/report/status?profileId=${encodeURIComponent(profileId)}&reportId=${encodeURIComponent(id)}`, {cache:"no-store"});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Status des Suchbegriffsreports konnte nicht geladen werden.");
      const status = String(data.status || "PROCESSING").toUpperCase();
      if (status === "COMPLETED") {
        saveSearchTermsState({reportId:id,status:"COMPLETED",rows:Array.isArray(data.rows) ? data.rows : []});
      } else if (["FAILED","FAILURE","ERROR"].includes(status)) {
        saveSearchTermsState({reportId:id,status:"FAILED"});
        setSearchTermsError("Amazon konnte den Suchbegriffsreport nicht fertigstellen.");
      } else {
        saveSearchTermsState({reportId:id,status:"PROCESSING"});
        setSearchTermsError("Der Report wird noch verarbeitet. Bitte später erneut den Status prüfen.");
      }
    } catch(e) {
      setSearchTermsError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally { setSearchTermsLoading(false); }
  }

  const searchTermSummary: any[] = (Object.values(searchTermsRows.reduce((acc:Record<string,any>, row:any) => {
    const term = String(row.searchTerm || "").trim();
    if (!term) return acc;
    const campaignId = String(row.campaignId || "");
    const key = term + "|" + campaignId;
    if (!acc[key]) acc[key] = {
      term, campaign: String(row.campaignName || "Ohne Kampagne"),
      clicks: 0, impressions: 0, cost: 0, orders: 0, sales: 0
    };
    acc[key].clicks += Number(row.clicks || 0);
    acc[key].impressions += Number(row.impressions || 0);
    acc[key].cost += Number(row.cost || 0);
    acc[key].orders += Number(row.purchases14d || 0);
    acc[key].sales += Number(row.sales14d || 0);
    return acc;
  }, {})) as any[]).sort((a:any,b:any) => b.orders-a.orders || b.sales-a.sales || b.clicks-a.clicks);

  useEffect(() => {
    loadHistories();
  }, [profileId]);

  // Der Zeitraum ist nur eine Ansicht auf den bereits ausgewählten Report.
  // Beim Wechsel von Heute/Gestern/Vorgestern/7 Tage werden die gespeicherten
  // Zeilen des jeweils manuell ausgewählten Performance- und Keyword-Reports
  // neu gefiltert. Es wird dabei KEIN anderer Report automatisch ausgewählt.
  useEffect(() => {
    const p=performanceHistory.find(x=>x.reportId===selectedPerformanceReport);
    if (p?.status==="COMPLETED") applyPerformanceHistory(p, dateRange);
  }, [selectedPerformanceReport, performanceHistory, dateRange]);

  useEffect(() => {
    const k=keywordHistory.find(x=>x.reportId===selectedKeywordReport);
    if (k?.status==="COMPLETED") applyKeywordHistory(k, dateRange);
  }, [selectedKeywordReport, keywordHistory, dateRange]);

  const selected = profiles.find(p => p.amazon_profile_id === profileId);
  const selectedPerformanceHistoryItem = performanceHistory.find(r => r.reportId === selectedPerformanceReport);
  const selectedKeywordHistoryItem = keywordHistory.find(r => r.reportId === selectedKeywordReport);
  const filteredCampaigns = stateFilter === "ALL" ? campaigns : campaigns.filter(c => c.state === stateFilter);
  const sortedCampaigns = [...filteredCampaigns].sort((a,b) => {
    const av = Number(campaignMetrics[a.campaignId]?.[sortBy] ?? 0);
    const bv = Number(campaignMetrics[b.campaignId]?.[sortBy] ?? 0);
    return sortDirection === "asc" ? av - bv : bv - av;
  });

  if (searchTermsOpen) {
    return <section className="dashboard search-terms-screen">
      <button className="filter-btn search-terms-back" onClick={() => setSearchTermsOpen(false)}>← Zurück zu den Kampagnen</button>
      <section className="search-terms-panel">
        <h2>Suchbegriffe – letzte 7 Tage</h2>
        <p>Die echten Suchanfragen, die Kunden bei Amazon eingegeben haben, mit Kampagne und Ergebnissen.</p>
        <div className="report-actions">
          <button className="filter-btn" onClick={requestSearchTermsReport} disabled={searchTermsLoading || reportLoading || keywordLoading}>
            {searchTermsLoading ? "Bitte warten..." : "Neuen 7-Tage-Suchbegriffsreport anfordern"}
          </button>
          {searchTermsReportId && searchTermsStatus !== "COMPLETED" && (
            <button className="filter-btn" onClick={() => checkSearchTermsReport()} disabled={searchTermsLoading}>
              {searchTermsLoading ? "Prüfe Status..." : "Status prüfen"}
            </button>
          )}
        </div>
        {searchTermsReportId && <div className="search-terms-status">Reportstatus: <strong>{searchTermsStatus==="COMPLETED"?"Fertig":searchTermsStatus==="PROCESSING"?"Wird verarbeitet":searchTermsStatus==="FAILED"?"Fehlgeschlagen":"Noch nicht angefordert"}</strong></div>}
        {searchTermsError && <div className="status warn">{searchTermsError}</div>}
        {searchTermsStatus === "COMPLETED" && searchTermSummary.length === 0 && <div className="keyword-empty">Der Report ist fertig, enthält aber keine Suchbegriffe für diesen Zeitraum.</div>}
        {searchTermSummary.length > 0 && (
          <div className="search-terms-table">
            <div className="search-terms-row search-terms-header">
              <span>Kundensuchbegriff</span><span>Kampagne</span><span>Klicks</span><span>Kosten</span><span>Bestellungen</span><span>Umsatz</span>
            </div>
            {searchTermSummary.map((item:any,i:number)=><div className="search-terms-row" key={item.term+"-"+item.campaign+"-"+i}>
              <strong>{item.term}</strong>
              <span data-label="Kampagne">{item.campaign}</span>
              <span data-label="Klicks">{item.clicks}</span>
              <span data-label="Kosten">{item.cost.toFixed(2)} €</span>
              <span data-label="Bestellungen">{item.orders}</span>
              <span data-label="Umsatz">{item.sales.toFixed(2)} €</span>
            </div>)}
          </div>
        )}
      </section>
    </section>;
  }

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

    <div className="search-terms-entry">
      <button className="filter-btn" onClick={() => setSearchTermsOpen(true)}>
        Suchbegriffe & beste Performance öffnen
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
      <div className="report-actions">
        <button className="filter-btn" onClick={()=>loadReport(true,7)} disabled={reportLoading || keywordLoading}>
          {reportLoading ? "Report wird angefordert..." : "Neuen 7-Tage-Report anfordern"}
        </button>
        <button className="filter-btn" onClick={()=>{setDateRange("TODAY"); loadReport(true,1,"TODAY")}} disabled={reportLoading || keywordLoading}>
          Heute anfordern
        </button>
      </div>
    </div>
    {performanceHistory.length > 0 && <div className="report-history">
      <label htmlFor="performance-report">Performance-Report</label>
      <select id="performance-report" value={selectedPerformanceReport} onChange={e=>{
  const id=e.target.value;
  setSelectedPerformanceReport(id);
  const item=performanceHistory.find(r=>r.reportId===id);
  if(item?.status==="COMPLETED") applyPerformanceHistory(item);
}}>
        {performanceHistory.map(r=><option key={r.id} value={r.reportId}>
          {new Date(r.requestedAt).toLocaleString("de-DE")} · {r.days} Tag{r.days===1?"":"e"} · {r.status==="COMPLETED"?"fertig":r.status==="PROCESSING"?"wird verarbeitet":"fehlgeschlagen"}
        </option>)}
      </select>
      {selectedPerformanceHistoryItem?.status==="PROCESSING" && (
        <div className="report-status-action">
          <button className="filter-btn status-check-btn" onClick={()=>checkPerformanceReport(selectedPerformanceHistoryItem)} disabled={reportLoading}>
            {reportLoading ? "Prüfe Status..." : "Status prüfen"}
          </button>
        </div>
      )}
    </div>}
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
        <div>
          <strong>Top 3 Keywords nach Kosten</strong>
          {keywordUpdatedAt && (
            <div className="performance-timestamp">
              Datenstand: {new Date(keywordUpdatedAt).toLocaleString("de-DE", {
                day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"
              })} Uhr
            </div>
          )}
        </div>
        <div className="report-actions">
          <button className="filter-btn" onClick={()=>loadKeywordReport(true,7)} disabled={keywordLoading || reportLoading}>
            {keywordLoading ? "Report wird angefordert..." : "Neuen 7-Tage-Report anfordern"}
          </button>
          <button className="filter-btn" onClick={()=>{setDateRange("TODAY"); loadKeywordReport(true,1,"TODAY")}} disabled={keywordLoading || reportLoading}>
            Heute anfordern
          </button>
        </div>
      </div>
      {keywordHistory.length > 0 && <div className="report-history">
        <label htmlFor="keyword-report">Keyword-Report</label>
        <select id="keyword-report" value={selectedKeywordReport} onChange={e=>{
  const id=e.target.value;
  setSelectedKeywordReport(id);
  const item=keywordHistory.find(r=>r.reportId===id);
  if(item?.status==="COMPLETED") applyKeywordHistory(item);
}}>
          {keywordHistory.map(r=><option key={r.id} value={r.reportId}>
            {new Date(r.requestedAt).toLocaleString("de-DE")} · {r.days} Tag{r.days===1?"":"e"} · {r.status==="COMPLETED"?"fertig":r.status==="PROCESSING"?"wird verarbeitet":"fehlgeschlagen"}
          </option>)}
        </select>
        {selectedKeywordHistoryItem?.status==="PROCESSING" && (
          <div className="report-status-action">
            <button className="filter-btn status-check-btn" onClick={()=>checkKeywordReport(selectedKeywordHistoryItem)} disabled={keywordLoading}>
              {keywordLoading ? "Prüfe Status..." : "Status prüfen"}
            </button>
          </div>
        )}
      </div>}
      {topKeywords.length > 0 ? (
        <div className="keyword-table-wrap">
          <div className="keyword-header">
            <div>Keyword</div><div>Kampagne</div><div>Gebot</div><div>Kosten</div><div>Klicks</div><div>Bestellungen</div>
          </div>
          {topKeywords.map((k,i)=><div className="keyword-row" key={`${k.campaignName}-${k.keyword}-${i}`}>
            <div className="keyword-cell keyword-name" data-label="Keyword">{k.keyword} <small className="campaign-keyword-type">{k.matchType === "EXACT" ? "Genau" : k.matchType === "PHRASE" ? "Wortgruppe" : k.matchType === "BROAD" ? "Weit" : k.matchType}</small></div>
            <div className="keyword-cell keyword-campaign" data-label="Kampagne">{k.campaignName}</div>
            <div className="keyword-cell keyword-number" data-label="Gebot">{k.bid > 0 ? `${k.bid.toFixed(2)} €` : "–"}</div>
            <div className="keyword-cell keyword-number" data-label="Kosten">{k.cost.toFixed(2)} €</div>
            <div className="keyword-cell keyword-number" data-label="Klicks">{k.clicks}</div>
            <div className="keyword-cell keyword-number" data-label="Bestellungen">{k.purchases14d}</div>
          </div>)}
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
        {getCampaignTopKeywords(c.campaignId).length > 0 && (
          <div className="campaign-keywords">
            <strong>Top 3 Keywords nach Kosten</strong>
            <div className="campaign-keyword-list">
              {getCampaignTopKeywords(c.campaignId).map((k,i)=><div className="campaign-keyword-row" key={`${k.keyword}-${i}`}>
                <span className="campaign-keyword-name">{k.keyword} <small className="campaign-keyword-type">{k.matchType === "EXACT" ? "Genau" : k.matchType === "PHRASE" ? "Wortgruppe" : k.matchType === "BROAD" ? "Weit" : k.matchType}</small></span>
                <span className="campaign-keyword-bid">Gebot {k.bid > 0 ? `${k.bid.toFixed(2)} €` : "–"}</span><span className="campaign-keyword-cost">Kosten {k.cost.toFixed(2)} €</span>
                <span className="campaign-keyword-clicks">{k.clicks} Klicks</span>
                <span className="campaign-keyword-orders">{k.purchases14d} Best.</span>
              </div>)}
            </div>
          </div>
        )}
      </div>)}
    </div>
  </section>;
}
