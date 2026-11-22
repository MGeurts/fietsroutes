# Publiceren van v1.0.0 op Antagonist Slim zonder Node.js

## Productieopzet

De app moet op Antagonist.nl shared hosting, pakket **Slim**, draaien zonder Node.js. Dat kan met de huidige browserapp: Vite bouwt lokaal HTML, JavaScript en CSS; Antagonist levert die bestanden rechtstreeks aan bezoekers. Routering over het officiële netwerk, routeopslag en de bediening draaien in de browser.

Op Antagonist zijn voor deze versie geen npm-installatie, Node-proces, database, cronjob, Composer-installatie of frameworkserver nodig. De meegeleverde PHP-ingang is optioneel; Apache krijgt via `.htaccess` eerst `index.html` als startpagina aangeboden.

## Domein en HTTPS

Gebruik een eigen domein of subdomein met de app in de hoofdmap daarvan, bijvoorbeeld `https://fietsen.voorbeeld.nl/`. De build gebruikt absolute paden zoals `/assets/` en `/data/network.json`; installatie onder een pad als `/fietsroutes/` is momenteel niet ondersteund.

Zorg dat HTTPS actief is, met een geldig certificaat, en configureer het domein voor gebruik via HTTPS. Dit is nodig voor geolocatie en de serviceworker/PWA. Antagonist beschrijft [SSL](https://help.antagonist.nl/hc/nl/articles/8523984806417-Welke-verschillende-SSL-vormen-zijn-er) en [subdomeinen aanmaken](https://help.antagonist.nl/hc/nl/articles/8523999326737-Hoe-kan-ik-subdomeinen-aanmaken) in de eigen documentatie.

De meegeleverde `.htaccess` stuurt HTTP permanent met status 301 naar dezelfde URL via HTTPS. Activeer het certificaat voordat je de release online zet. De redirect maakt zelf geen certificaat aan. Het pad en de querystring blijven behouden. De externe kaart-, zoek- en aanrijdiensten worden eveneens via HTTPS aangesproken.

## Lokaal bouwen

Lokaal gebruiken we **[Flock](https://flockphp.com/)**. De gebouwde app is daar bereikbaar op `https://fietsroutes.test`, met `dist/` als documentroot. Flock is uitsluitend de lokale ontwikkelomgeving en hoeft niet op Antagonist geïnstalleerd te worden.

Voer op je ontwikkelcomputer in de projectmap uit:

```powershell
npm ci
npm test
npm run build
```

Het resultaat is `dist/`. Via `postbuild` wordt automatisch `releases/fietsroutes-antagonist.zip` aangemaakt. De volgende geslaagde build vervangt dit archief met de nieuwste inhoud. Uploaden blijft een afzonderlijke stap.

De belangrijke bestanden in `dist/` zijn:

```text
dist/
  .htaccess
  index.html
  index.php
  assets/
  data/network.json
  manifest.webmanifest
  sw.js
  icon.svg
  logo.svg
  logo.png
  logo.ico
```

`.htaccess` stelt het startbestand en MIME-types in, schakelt directorylisting uit, configureert compressie indien beschikbaar en laat versiegevoelige bestanden opnieuw valideren. Bestanden met een inhoudshash krijgen een lange cacheduur. Er is bewust geen regel die ontbrekende scripts door HTML vervangt: een verkeerd assetpad moet een 404 blijven geven.

## Uploaden

1. Maak zo nodig eerst een backup van de bestaande website in de doelmap.
2. Verbind via de bestandsbeheerder of FTPES met je hostingpakket. Antagonist noemt `public_html` als uploadmap; zie [de FTP-instellingen](https://help.antagonist.nl/hc/nl/articles/8524008537489-Welke-instellingen-heb-ik-nodig-voor-FTP). Kies bij een subdomein de bijbehorende documentroot uit DirectAdmin.
3. Upload de **inhoud** van `dist/` naar die map. Maak dus geen extra `dist`-map onder de documentroot.
4. Neem ook `.htaccess`, `data/`, de serviceworker en alle bestanden met een hash in de naam mee. Laat verborgen bestanden in je bestandsbeheerder tonen om `.htaccess` te controleren.
5. Open het HTTPS-adres en voer de onderstaande controles uit.

Upload niet de volledige repository, `src/`, `web/`, `node_modules/`, `.git/`, `.cache/`, ontwikkelconfiguratie of de `index.php` uit de projectroot. Gebruik de bestanden uit `dist/`. De officiële netwerksnapshot en iconen mogen wel publiek beschikbaar zijn.

## Automatische ZIP en handmatig alternatief

Normaal volstaat `npm run build`: de automatische ZIP bevat de volledige build inclusief `.htaccess`, en werkt op Windows en Linux. De ZIP wordt gecontroleerd voordat een bestaand archief wordt vervangen. Er draait geen bouwproces op Antagonist.

Als handmatig alternatief op Windows:

```powershell
New-Item -ItemType Directory -Force releases | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$releasePath = Join-Path (Resolve-Path releases).Path ("fietsroutes-antagonist-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
[System.IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path dist).Path, $releasePath)
```

Pak het archief uit in de documentroot. `index.html` en `.htaccess` moeten direct in die map terechtkomen. `releases/` is genegeerd door Git.

## Controleren na publicatie

Vanaf je ontwikkelcomputer:

```powershell
npm run check:host -- https://fietsen.voorbeeld.nl
```

Deze controle gebruikt lokaal Node.js om HTTP-antwoorden te inspecteren, waaronder de HTTP-naar-HTTPS-redirect. De HTTPS-aanvragen controleren standaard ook de certificaatketen. Er draait daardoor geen Node-proces op Antagonist.

Controleer daarnaast in een gewone browser:

- De startpagina, netwerkgegevens en kaart laden zonder module- of MIME-fouten.
- De drie kaartlagen werken en OSM + Fietsnetwerk is bij een nieuwe start geselecteerd.
- Een plaats zoeken, een route plannen, bewaren en GPX downloaden werken.
- Een deellink met `#route=...` opent de gekozen punten.
- Na locatietoestemming verschijnt de positie en, bij een gekozen start, de gestippelde aanrijroute.
- Na een volledige eerste online laadbeurt kan de geïnstalleerde app zonder internet opnieuw openen met haar netwerk en lokale routes. Externe kaarten en nieuwe online zoek-/routeringsaanvragen zijn dan niet beschikbaar.

GPS, schermgedrag en navigatie moeten ook op echte smartphones worden getest. Een geslaagde build of HTTP-controle bewijst dat niet.

## Updates en browseropslag

Bouw elke release lokaal opnieuw. Upload eerst de nieuwe bestanden in `assets/` en nieuwe Workbox-bestanden. Upload daarna de dataset en overige bestanden, en als laatste de nieuwe HTML en serviceworker. Houd de updateperiode zo kort mogelijk; een gewone FTP-upload is niet atomair. Verwijder oude bestanden met hashes niet tijdens het uploaden, want open appvensters kunnen die nog gebruiken.

Als een vorige versie zichtbaar blijft, herlaad de pagina, zo nodig met Ctrl+Shift+R. Een nieuwe build wacht op de knop Bijwerken. De werkroute wordt eerst lokaal bewaard en na herladen hersteld; tijdens navigatie is bijwerken uitgeschakeld. Laat gebruikers hun browseropslag niet wissen als standaardoplossing: hun bibliotheek staat daarin.

De bibliotheek hoort bij de browser én de origin (protocol, hostnaam en poort). Routes op `https://fietsroutes.test` verschijnen niet automatisch op het productiedomein. Exporteer op het oude adres een JSON-backup en importeer die op het nieuwe adres. Kies daarom bij voorkeur vooraf een vast productieadres.

## Grenzen van deze publicatieopzet

Kaarttegels komen van OSM of CyclOSM, plaatszoeken gebruikt Photon en de aanrijroute gebruikt BRouter. Deze diensten worden vanuit de browser aangesproken en moeten bereikbaar zijn. De shared host berekent die routes niet. Er zijn geen API-sleutels voor deze versie nodig.

Bij updates van het officiële netwerk voer je de importer op de ontwikkelcomputer of in CI uit, controleer je de resultaten en publiceer je opnieuw. Op Antagonist is daarvoor geen download- of importtaak nodig.

Gebruik lokaal `npm run data:update` voor ophalen, testen, bouwen en inpakken in één opdracht. Zie [updates automatiseren](UPDATES.md) voor periodieke alternatieven. Er is nog geen periodieke taak of automatische upload ingesteld.

De lokale Flock-werking en build kunnen hier worden gecontroleerd. De serverconfiguratie en volledige werking op het eigen Antagonist-account moeten na de daadwerkelijke upload nog worden geverifieerd; er is in deze taak niet op Antagonist ingelogd of gepubliceerd.


