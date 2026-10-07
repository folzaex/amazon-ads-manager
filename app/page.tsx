export default function Home(){
  return <main><div className="card">
    <h1>Amazon Ads Manager</h1>
    <p>Deine eigene Anwendung zur Analyse und späteren Verwaltung deiner Amazon-Ads-Kampagnen.</p>
    <div className="status warn">
      <strong>Amazon Ads Verbindung</strong><br/>
      Die technische Grundlage für die OAuth-Verbindung ist vorbereitet.
    </div>
    <a className="btn" href="/api/amazon/authorize">Mit Amazon Ads verbinden</a>
    <p className="small">Geheime Zugangsdaten werden ausschließlich serverseitig verarbeitet.</p>
  </div></main>
}
