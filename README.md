# Amazon Ads Manager

Technische Startversion für die eigene Amazon Ads API-Anbindung.

## Voraussetzungen

- GitHub Repository
- Vercel Projekt
- Login with Amazon (LWA) Security Profile
- Amazon Ads API Scope `advertising::campaign_management`

## Vercel Environment Variables

Noch **keine echten Geheimnisse in GitHub eintragen**.

In Vercel werden später mindestens benötigt:

- `AMAZON_LWA_CLIENT_ID`
- `AMAZON_LWA_CLIENT_SECRET`
- `APP_URL`

`APP_URL` ist die öffentliche Vercel-URL ohne abschließenden Slash.

## OAuth Callback

Der Callback dieser Version ist:

`/api/amazon/callback`

Die vollständige Return URL wird erst nach dem finalen Vercel-Deployment in den Amazon Developer Web Settings eingetragen.

## Wichtiger Hinweis

Diese Version ist die technische Grundlage. Vor einem produktiven Einsatz werden OAuth-/Token-Endpunkt, Token-Speicherung, Profilabruf und die Amazon-Ads-API-Aufrufe anhand der aktuellen Amazon-Dokumentation final verifiziert und gehärtet.
