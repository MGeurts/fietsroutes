# Ontwikkelaarsdocumentatie

## Uitgangspunten

De productieomgeving is **Antagonist.nl Slim shared hosting zonder Node.js**. Runtimecode draait in de browser; de webserver levert gebouwde HTML, JavaScript, CSS, afbeeldingen en de netwerksnapshot. Voeg geen Node-runtime, SSR-server, serverless functie of achtergrondproces toe als productievereiste. Node.js 26 en npm blijven lokale/CI-bouwgereedschappen. Zie [publiceren op Antagonist](ANTAGONIST.md).

De app gebruikt React, TypeScript, Vite, Leaflet en een door Workbox gegenereerde serviceworker. Er is geen accountbackend of database. PHP is alleen een optionele ingang voor PHP-hosting en de lokale Flock-server.

## Projectstructuur

| Pad | Verantwoordelijkheid |
| --- | --- |
| `web/index.html` | HTML-ingang voor Vite; buiten de documentroot houden. |
| `src/App.tsx` | Routebewerkingen, schermen, kaartkeuze, bibliotheek en fietsmodus. |
| `src/components/MapView.tsx` | Leaflet, kaartlagen, puntmarkeringen, aanrijroute, zoomevents en centreren. |
| `src/domain/network.ts` | Gegevensmodel, graaf, kortste paden, rondritten en GPS-voortgang. |
| `src/domain/spatialIndex.ts` | Ruimtelijke rasterindex voor zichtbare trajecten, knooppunten en richtingspijlen. |
| `src/components/RoutePointList.tsx` | Gememoiseerde knooppuntenlijst; stabiele callbacks voorkomen hertekenen bij GPS-updates. |
| `src/domain/draft.ts`, `src/useRouteDraft.ts` | Gevalideerde lokale herstelkopie, opslag vóór afsluiten en vertrekbeveiliging. |
| `src/components/UpdateNotice.tsx` | Gecontroleerde PWA-registratie en bijwerken na veilige routeopslag. |
| `src/domain/pointRoles.ts` | Rollen per bezoek en de gecombineerde marker voor Start/Einde. |
| `src/domain/itinerary.ts` | Alle genummerde bezoeken en hun deelafstanden en fietstijden. |
| `src/domain/routeNames.ts` | Rondritnamen, genummerde kopieën en GPX-bestandsnamen. |
| `src/domain/storage.ts` | Validatie, lokale bibliotheek en samenvoegen van backups. |
| `src/domain/gpx.ts` | GPX-uitvoer, eigen GPX-herimport en bestandsdownload. |
| `src/domain/places.ts`, `src/usePlaces.ts` | Photon-adapter, vertraagd zoeken, annulering en tijdelijke cache. |
| `src/domain/approach.ts`, `src/useApproach.ts` | BRouter-adapter, geometriecontrole, herberekening en tijdelijke cache. |
| `src/useDeviceLocation.ts` | Verse GPS-watch bij opstart, eerste centrering, fouten en opruimen. |
| `public/` | Te kopiëren statische bestanden, Apache-configuratie en optionele PHP-ingang. |
| `scripts/import-network.mjs` | Import en kwaliteitscontroles van de officiële WFS-data. |
| `scripts/export-logo.mjs` | Reproduceerbare SVG-, PNG- en ICO-export van het headerlogo. |
| `scripts/check-host.mjs` | HTTP-controle van een draaiende productiebuild. |
| `scripts/package-antagonist.mjs` | Platformonafhankelijke ZIP-export na elke build, met inhoudscontrole en tijdelijke bestanden vóór vervanging. |
| `dist/` | Gegenereerde productie-uitvoer; niet handmatig aanpassen. |

## Lokaal ontwikkelen en bouwen

De lokale ontwikkelomgeving is **[Flock](https://flockphp.com/)**. Flock verzorgt de lokale webserver, het HTTPS-adres en het beheer van PHP- en Node.js-versies. Voer de onderstaande opdrachten uit in de projectmap met Node.js 26 en npm. Open vervolgens de gebouwde app via de Flock-site; start hiervoor geen extra PHP- of Node-webserver.

```powershell
npm ci
npm test
npm run build
```

`npm run build` start na een geslaagde Vite-build automatisch `postbuild`, dat de Antagonist-ZIP bijwerkt. `npm run data:update` voert de netwerkimport, tests en die build achtereenvolgens uit; bij een fout stopt de keten. De ZIP-verpakking gebruikt fflate als ontwikkelafhankelijkheid en vereist geen Node.js op de hosting.

Flock serveert `https://fietsroutes.test`, met `root=dist` in `.flockrc`. De gekopieerde `public/index.php` ondersteunt Flocks PHP-ingang op `/`; statische hosting kan rechtstreeks `index.html` gebruiken. De afzonderlijke `index.php` in de projectmap is een oudere alternatieve doorgeeflaag naar `dist/`; upload de projectmap niet naar Antagonist.

Alleen als alternatief buiten de gebruikelijke Flock-werkwijze kun je `npm run dev` gebruiken voor Vite met live herladen. Het Vite-project heeft `web/` als root, `public/` als bron van statische bestanden en `dist/` als bouwuitvoer. Zo kan de productie-ingang niet met de HTML voor ontwikkeling worden verwisseld.

De eigen serviceworker in `src/sw.js` wordt via `injectManifest` gebouwd. Navigaties worden vóór de precacheroute geregistreerd: online wordt HTML met `cache: no-store` opgehaald; bij een netwerkfout dient de vooraf opgeslagen HTML als offlinefallback. Een oude serviceworker van vóór deze aanpak kan nog een vorige appversie tonen. Een nieuwe worker wacht op de knop Bijwerken. De werkroute wordt vóór de update bewaard; tijdens navigatie is de updateknop uitgeschakeld. Herlaad vervolgens de pagina, zo nodig met Ctrl+Shift+R. Verwijder geen sitegegevens om een weergaveprobleem op te lossen zonder eerst routes te exporteren.

## Netwerkgegevens

De officiële WFS is `https://geodata.toerismevlaanderen.be/geoserver/wfs`. De importer gebruikt `routes:knoop_fiets` en `routes:traject_fiets`, WFS 2.0.0, gepagineerde GeoJSON en EPSG:4326. Oudere metadata vermelden nog de namespace `tvl`; die wordt niet gebruikt.

```powershell
npm run data:refresh
npm test
npm run build
```

Het resultaat staat in `public/data/network.json`, met ophaaldatum, bronvermelding en kwaliteitsrapport. De snapshot van 21 november 2026 bevat 5.138 punten, waarvan 5.002 genummerd, en 7.575 bruikbare trajecten. De bronrecords bevatten tevens ongenummerde aansluitpunten.

De topologie volgt `geoid`, `begin_geoid` en `end_geoid`. Gedeelde bronidentiteiten worden alleen samengevoegd bij consistente nummers en posities. Identieke nummers of nabije coördinaten zijn op zichzelf nooit een aansluiting. Trajectgeometrie wordt georiënteerd en tegen de uiteinden gecontroleerd; ontbrekende geometrie wordt niet door rechte lijnen vervangen.

Het rapport van deze snapshot bevat:

- 158 uitgesloten trajecten wegens ontbrekende/ambigue aansluitingen of eenrichting, waaronder 90 eenrichtingstrajecten waarvan de richtingsemantiek nog moet worden gevalideerd.
- 7 uitgesloten trajecten wegens geometrieproblemen.
- 31 uitgesloten knooppuntrecords met conflicterende bronidentiteit.
- 44 samengevoegde knooppuntrecords.

De importer vervangt de snapshot pas na volledigheidscontroles. Ruwe brondata staan lokaal in de genegeerde `.cache/wfs-source.json`. `node scripts/import-network.mjs --cached` verwerkt deze opnieuw zonder download. Data verversen gebeurt op de ontwikkelcomputer of in CI, niet op de shared host; publiceer daarna de nieuwe build.

Bron: [metadata Toerisme Vlaanderen](https://metadata.vlaanderen.be/srv/api/records/c91e9b9d-6465-4dec-beeb-16fdc6d759a0), met verwijzing naar de modellicentie voor gratis hergebruik.

## Routering, bezoeken en tijden

Dijkstra met een binaire min-heap zoekt de kortste afstand over de toegelaten verbindingen. Afstanden komen uit de geometrie. Rondritten worden opgebouwd uit kandidaatpunten in meerdere richtingen; ongeschikte lussen en veel dubbel bereden afstand worden geweigerd.

Maak onderscheid tussen `stops` (gekozen punten), `junctions` (alle bezoeken) en `steps` (opeenvolgende trajecten). Dezelfde identiteit kan tijdens een route meerdere keren met een andere rol voorkomen. Classificeer lijstitems dus niet met uitsluitend een verzameling gekozen ID's. `pointRoles.ts` bepaalt de rol per bezoek; de kaart combineert rollen waar één marker meerdere bezoeken vertegenwoordigt.

`itinerary.ts` telt de afstanden van eventuele ongenummerde aansluitpunten op tot het volgende zichtbare genummerde bezoek. Alleen items met een `stopIndex` zijn rechtstreeks verwijderbare gekozen punten. De tijd is een schatting op basis van de geometrieafstand en de ingestelde constante fietssnelheid: standaard e-bike 20 km/u, daarnaast 15, 18 en 25 km/u.

GPS-projectie gebruikt een voortgangsvenster om sprongen naar latere kruisingen of het einde van een lus te voorkomen. Bij meer dan 75 meter gemelde GPS-onnauwkeurigheid wordt de voortgang niet bijgewerkt. Het voorwaartse venster is 1,5 km; langere onderbrekingen vereisen nog verdere praktijktests.

## Kaartperformantie

Een rasterindex op vooraf berekende begrenzingen vervangt het doorzoeken van alle coördinaten bij iedere kaartbeweging. Ook een traject dat het kaartvenster kruist zonder zichtbare vertex wordt gevonden. Alleen objecten die binnenkomen of verdwijnen worden toegevoegd/verwijderd; zichtbare markers en lijnen blijven bestaan. Een gewijzigde route past alleen de markerrollen aan. De locatiestip en nauwkeurigheidskring blijven dezelfde Leaflet-objecten.

Richtingspijlen worden eenmaal per route en zoomniveau berekend en ruimtelijk geïndexeerd. Verschuiven filtert die posities zonder de volledige route opnieuw te projecteren. Hertekenen wordt via requestAnimationFrame samengevoegd. De knooppuntenlijst en haar invoergegevens zijn gememoiseerd en krijgen stabiele callbacks.

## Opslag en uitwisseling

De bibliotheek staat als JSON onder `fietsroutes:library:v1` in `localStorage`. Records bevatten `id`, `name`, `stops`, `favorite` en `updatedAt`. Een route heeft 2–200 gekozen punten en een naam van maximaal 120 tekens. Bij openen worden trajecten opnieuw berekend op de meegeleverde snapshot. Fietsprofiel en historische geometrie worden niet in de bibliotheek bewaard.

Backupimport valideert de records, controleert routeerbaarheid, kent nieuwe ID's toe en slaat identieke naam/puntcombinaties over. Een onleesbare bibliotheek blokkeert schrijven om onbedoeld gegevensverlies te voorkomen. Kopieën krijgen unieke namen in de vorm `(kopie N)`; bestaande records worden niet achteraf hernoemd.

GPX bewaart de gekozen punten met de eigen namespace `https://fietsroutes.app/schema/1` en schrijft brontrajecten als afzonderlijke tracksegmenten. De importer ondersteunt die eigen uitvoer; externe GPX-koppeling volgt later. `gpxFilename()` behoudt onder meer decimale komma's en verwijdert tekens die Windows-bestandsnamen niet toestaan.

Een afzonderlijke herstelkopie staat onder `fietsroutes:draft:v1`. Deze bewaart de actuele puntkeuze, naam, fietsprofiel, kaartlaag en bibliotheek-ID, maar geen locatie. Herstel wordt gevalideerd vóór gebruik en pas na geladen/valide netwerkgegevens opnieuw geschreven. Een deellink heeft voorrang; de geconsumeerde routehash wordt verwijderd zodat herladen latere wijzigingen behoudt. Bewust leegmaken verwijdert de herstelkopie. Onleesbaar herstel wordt niet stilzwijgend overschreven. De browserbibliotheek blijft een aparte opslag.

Deellinks gebruiken `#route=...` met de gekozen knooppunt-ID's. Ze bevatten geen historische geometrie en hebben geen serverroutering nodig.

## Externe diensten en offline gedrag

| Dienst | Verstuurde gegevens | Gebruik |
| --- | --- | --- |
| OSM / CyclOSM | Aanvragen voor bekeken kaarttegels. | Achtergrondkaart. |
| Photon (`photon.komoot.io`) | Getypte zoektekst en een vaste regionale begrenzing; geen GPS-locatie. | Plaatsnamen vanaf twee letters. |
| BRouter (`brouter.de/brouter`) | Actuele locatie en het startpunt, met profiel `trekking`. | Fietsaanrijroute buiten de lokale knooppuntenberekening. |
| Toerisme Vlaanderen | WFS-aanvragen vanuit de importer. | Alleen tijdens het verversen van de lokale dataset. |

Photon en BRouter worden rechtstreeks vanuit de browser aangesproken. Nieuwe invoer/startpunten annuleren oudere aanvragen en late antwoorden mogen de actuele resultaten niet overschrijven. Hun caches zijn alleen in het geheugen aanwezig. De aanrijroute herberekent bij minimaal 50 meter verplaatsing en verdwijnt binnen 25 meter van de start. Na het bereiken van de start of voldoende routevoortgang tijdens navigatie worden lopende BRouter-aanvragen geannuleerd en nieuwe aanvragen onderdrukt tot die navigatiesessie stopt of het startpunt wijzigt. Een resultaat met een uiteinde meer dan 100 meter van de gevraagde locatie wordt geweigerd.

PWA-registratie gebeurt expliciet via `virtual:pwa-register/react`. Automatische activatie is uitgeschakeld: een nieuwe worker wacht op Bijwerken. De updateknop schrijft eerst de werkroute en staat tijdens navigatie uit. `activateUpdate` stuurt SKIP_WAITING naar de werkelijk wachtende worker, wacht op controleovername en herlaadt dan. Na 15 seconden zonder overname stopt het wachten met een foutmelding. Bij opslag- of updatefouten blijft vertrekbeveiliging actief. Registraties worden opnieuw gecontroleerd bij online komen, terugkeren naar het tabblad en ieder uur terwijl het tabblad zichtbaar is. Dit controleert een nieuwe gepubliceerde appbuild en haalt niet zelf WFS-brondata op.

De serviceworker precachet gebouwde appbestanden en de netwerksnapshot. Kaarttegels worden niet door de serviceworker opgeslagen of vooraf gedownload. Offline kaarten vereisen een andere provider of eigen infrastructuur met passende rechten.

## Controles

```powershell
npm test
npm run build
npm audit
npm run check:host
php -l index.php
php -l public/index.php
```

De tests controleren routering, datasetgeometrie, rondritten, lussen bij GPS, geolocatie, geweigerde toestemming, annulering van zoek- en aanrijaanvragen, XML-escaping, backups, roltoekenning, deelafstanden, tijden, kopienummering en bestandsnamen. De GitHub-workflow voert `npm ci`, `npm test` en `npm run build` uit op Node.js 26.

`npm run check:host` vereist de lokale Flock-site. Met `npm run check:host -- https://jouwdomein.nl` controleer je dezelfde productie-ingang op een andere host. De controle vergelijkt `/` en `/index.html`, controleert JavaScript-MIME-types en controleert dat bronpaden 404 opleveren. Dit is geen controle van GPS of mobiele navigatie.

## Logo en verdere ontwikkeling

`node scripts/export-logo.mjs` genereert vanuit het headerlogo `public/logo.svg`, `public/logo.png` (512 px) en `public/logo.ico` (16, 24, 32, 48, 64, 128 en 256 px). Sharp is hiervoor een ontwikkelafhankelijkheid; de hosting heeft Sharp of Node.js niet nodig. `public/icon.svg` blijft afzonderlijk in gebruik als favicon/PWA-icoon.

Openstaande onderwerpen zijn validatie van eenrichtingstrajecten en bronconflicten, praktijktests op Android en iPhone, externe GPX-koppeling, hoogteprofielen, verplaatsen van routepunten, een ander startpunt voor een bestaande gesloten lus, offline kaarten en eventuele synchronisatie of gesproken aanwijzingen. Behoud bij toekomstige uitbreidingen de productievoorwaarde: Antagonist Slim zonder Node-runtime.


