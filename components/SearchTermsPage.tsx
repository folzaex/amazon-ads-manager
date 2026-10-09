"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = { id:string; amazon_profile_id:string|null; profile_name:string|null; country_code:string|null };
type SearchTermRow = {
  date?:string; searchTerm?:string; campaignId?:string; campaignName?:string;
  clicks?:number|string; impressions?:number|string; cost?:number|string;
  purchases14d?:number|string; sales14d?:number|string;
};
type Saved = { reportId:string; status:"NONE"|"PROCESSING"|"COMPLETED"|"FAILED"; rows:SearchTermRow[] };

export default function SearchTermsPage({profiles, initialProfileId}:{profiles:Profile[];initialProfileId:string}) {
  const [profileId,setProfileId]=useState(initialProfileId || profiles.find(p=>p.country_code==="DE")?.amazon_profile_id || profiles[0]?.amazon_profile_id || "");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<Saved>({reportId:"",status:"NONE",rows:[]});
  const [sortBy,setSortBy]=useState<"orders"|"sales"|"clicks"|"cost">("orders");
  const [search,setSearch]=useState("");

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(`amazon-ads-search-terms:v1:${profileId}`);
      setSaved(raw ? JSON.parse(raw) : {reportId:"",status:"NONE",rows:[]});
      setError("");
    } catch { setSaved({reportId:"",status:"NONE",rows:[]}); }
  },[profileId]);

  function persist(next:Saved) {
    setSaved(next);
    try { localStorage.setItem(`amazon-ads-search-terms:v1:${profileId}`,JSON.stringify(next)); } catch {}
  }

  async function checkStatus(id=saved.reportId) {
    if(!id) return;
    setLoading(true);setError("");
    try {
      const res=await fetch(`/api/amazon/report/status?profileId=${encodeURIComponent(profileId)}&reportId=${encodeURIComponent(id)}`,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || "Der Reportstatus konnte nicht geladen werden.");
      const status=String(data.status||"PROCESSING").toUpperCase();
      if(status==="COMPLETED") persist({reportId:id,status:"COMPLETED",rows:Array.isArray(data.rows)?data.rows:[]});
      else if(["FAILED","FAILURE","ERROR"].includes(status)) {
        persist({...saved,reportId:id,status:"FAILED"});
        setError("Amazon konnte den Report nicht fertigstellen.");
      } else {
        persist({...saved,reportId:id,status:"PROCESSING"});
        setError("Amazon verarbeitet den Report noch. Bitte später erneut den Status prüfen.");
      }
    } catch(e) { setError(e instanceof Error?e.message:"Unbekannter Fehler."); }
    finally { setLoading(false); }
  }

  async function requestReport() {
    setLoading(true);setError("");
    try {
      const res=await fetch("/api/amazon/search-terms/report/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId}),cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || "Suchbegriffsreport konnte nicht angefordert werden.");
      const next:Saved={reportId:String(data.reportId),status:"PROCESSING",rows:[]};
      persist(next);
      await checkStatus(next.reportId);
    } catch(e) { setError(e instanceof Error?e.message:"Unbekannter Fehler."); }
    finally { setLoading(false); }
  }

  const summary=useMemo(()=>{
    const map=new Map<string,any>();
    for(const row of saved.rows||[]) {
      const term=String(row.searchTerm||"").trim();
      if(!term) continue;
      const campaignId=String(row.campaignId||"");
      const key=term+"|"+campaignId;
      const x=map.get(key)||{term,campaign:String(row.campaignName||"Ohne Kampagne"),clicks:0,impressions:0,cost:0,orders:0,sales:0};
      x.clicks+=Number(row.clicks||0);
      x.impressions+=Number(row.impressions||0);
      x.cost+=Number(row.cost||0);
      x.orders+=Number(row.purchases14d||0);
      x.sales+=Number(row.sales14d||0);
      map.set(key,x);
    }
    const q=search.trim().toLocaleLowerCase("de-DE");
    return [...map.values()].filter(x=>!q || x.term.toLocaleLowerCase("de-DE").includes(q) || x.campaign.toLocaleLowerCase("de-DE").includes(q))
      .sort((a,b)=>b[sortBy]-a[sortBy]);
  },[saved.rows,sortBy,search]);

  const fmt=(n:number)=>n.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
  const totals=summary.reduce((a,x)=>({clicks:a.clicks+x.clicks,cost:a.cost+x.cost,orders:a.orders+x.orders,sales:a.sales+x.sales}),{clicks:0,cost:0,orders:0,sales:0});

  return <main className="search-terms-page">
    <a className="filter-btn search-terms-back" href="/">← Zurück zu den Kampagnen</a>
    <header className="search-terms-page-header">
      <div><p className="search-terms-eyebrow">AMAZON ADS · AUSWERTUNG</p><h1>Kundensuchbegriffe</h1>
      <p>Welche Suchanfragen bringen Klicks, Bestellungen und Umsatz? Hier siehst du die tatsächlichen Suchbegriffe zusammen mit der jeweiligen Kampagne.</p></div>
      <span className="search-terms-period">Letzte 7 Tage</span>
    </header>
    <div className="search-terms-controls">
      <label>Amazon-Ads-Profil
        <select value={profileId} onChange={e=>setProfileId(e.target.value)}>
          {profiles.map(p=><option key={p.id} value={p.amazon_profile_id||""}>{p.country_code ? p.country_code+" – " : ""}{p.profile_name||"Profil"} ({p.amazon_profile_id})</option>)}
        </select>
      </label>
      <button className="btn" onClick={requestReport} disabled={loading || !profileId}>{loading?"Bitte warten…":"Neuen 7-Tage-Report anfordern"}</button>
      {saved.reportId && saved.status!=="COMPLETED" && <button className="filter-btn" onClick={()=>checkStatus()} disabled={loading}>{loading?"Prüfe Status…":"Status prüfen"}</button>}
    </div>
    {saved.reportId && <div className={`search-terms-status-pill ${saved.status.toLowerCase()}`}>Status: <strong>{saved.status==="COMPLETED"?"Fertig":saved.status==="PROCESSING"?"Wird verarbeitet":saved.status==="FAILED"?"Fehlgeschlagen":"Nicht angefordert"}</strong></div>}
    {error && <div className="status warn">{error}</div>}
    {saved.status==="COMPLETED" && <>
      <div className="search-terms-kpis">
        <div><span>Suchbegriffe</span><strong>{summary.length}</strong></div>
        <div><span>Klicks</span><strong>{totals.clicks.toLocaleString("de-DE")}</strong></div>
        <div><span>Kosten</span><strong>{fmt(totals.cost)} €</strong></div>
        <div><span>Bestellungen</span><strong>{totals.orders.toLocaleString("de-DE")}</strong></div>
        <div><span>Umsatz</span><strong>{fmt(totals.sales)} €</strong></div>
      </div>
      <div className="search-terms-table-tools">
        <label className="search-terms-search">Suchen<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchbegriff oder Kampagne…"/></label>
        <label>Sortieren nach<select value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}>
          <option value="orders">Bestellungen</option><option value="sales">Umsatz</option><option value="clicks">Klicks</option><option value="cost">Kosten</option>
        </select></label>
      </div>
      {summary.length ? <div className="search-terms-table">
        <div className="search-terms-row search-terms-header"><span>Kundensuchbegriff</span><span>Kampagne</span><span>Klicks</span><span>Kosten</span><span>Bestellungen</span><span>Umsatz</span></div>
        {summary.map((x,i)=><div className="search-terms-row" key={x.term+"-"+x.campaign+"-"+i}>
          <strong>{x.term}</strong><span data-label="Kampagne">{x.campaign}</span><span data-label="Klicks">{x.clicks.toLocaleString("de-DE")}</span><span data-label="Kosten">{fmt(x.cost)} €</span><span data-label="Bestellungen">{x.orders.toLocaleString("de-DE")}</span><span data-label="Umsatz">{fmt(x.sales)} €</span>
        </div>)}
      </div> : <div className="keyword-empty">Keine passenden Suchbegriffe für diese Suche.</div>}
    </>}
    {saved.status==="NONE" && <div className="keyword-empty">Fordere einen 7-Tage-Report an, um die Suchbegriffe auszuwerten.</div>}
  </main>;
}