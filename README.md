<p align="center">
  <img src="./public/fietsroute-logo.png" alt="Logo van Fietsroute Planner NL & BE" width="240">
</p>

# Fietsroute Planner NL & BE

![](https://img.shields.io/badge/React-19-informational?style=flat&logo=react&color=61DAFB)
![](https://img.shields.io/badge/TypeScript-5.8-informational?style=flat&logo=typescript&color=3178C6)
![](https://img.shields.io/badge/Vite-6-informational?style=flat&logo=vite&color=646CFF)
![](https://img.shields.io/badge/Leaflet-1.9-informational?style=flat&logo=leaflet&color=199900)
![](https://img.shields.io/badge/Tailwind_CSS-4-informational?style=flat&logo=tailwindcss&color=06B6D4)
[![Laatste release](https://img.shields.io/github/v/release/MGeurts/fietsroutes?label=release)](https://github.com/MGeurts/fietsroutes/releases/latest)

[![Licentie: MIT](https://img.shields.io/badge/licentie-MIT-blue.svg)](LICENSE)
[![OpenStreetMap](https://img.shields.io/badge/kaartdata-OpenStreetMap-7EBC6F?logo=openstreetmap)](https://www.openstreetmap.org)
[![Steun via PayPal](https://img.shields.io/badge/Steun-PayPal-blue.svg?logo=paypal)](https://www.paypal.me/MGeurtsKREAWEB)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-orange.svg?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/MGeurts)

Een open-source planner voor fietsknooppunten in Nederland en België. De toepassing is een React/Vite-webapp die de gecontroleerde knooppuntendataset in de browser laadt en routes als GPX kan importeren of exporteren.

## Mogelijkheden

- Kies knooppunten op de kaart en maak een route over het knooppuntennetwerk.
- Gebruik gecontroleerde geometrie uit de ingebouwde Benelux-dataset. Bij een officiële relatie zonder volledige lijngeometrie wordt alleen dat ontbrekende segment live opgehaald en duidelijk als zodanig weergegeven. Niet-geverifieerde routering blijft herkenbaar als fallback.
- Toon automatisch gekozen tussenknooppunten, deelafstanden, totale afstand, geschatte duur en een hoogteprofiel.
- Importeer en exporteer GPX. Een uit deze app geëxporteerde route wordt bij import opnieuw gekoppeld aan nabije, routeerbare knooppunten wanneer die beschikbaar zijn.
- Druk een compact fietsknooppuntenstrookje af met de volledige knooppuntvolgorde, inclusief automatisch gekozen tussenpunten.
- Genereer gesloten rondritten van 15 tot 60 km. De generator stelt verschillende richtingen voor en gebruikt uitsluitend opeenvolgende knooppunten uit het netwerk.
- Kies een fietsprofiel voor de tijdsinschatting: stadsfiets (15 km/u), gravel/toerfiets (18 km/u), e-bike (20 km/u) of racefiets (25 km/u).
- Kies een achtergrondkaart: Standard OSM (standaard), CyclOSM, OSM + Fietsnetwerk of OpenCycleMap. Voor OpenCycleMap is een eigen Thunderforest-sleutel optioneel; zonder sleutel kan die dienst een watermerk tonen.

## Data en netwerkstatus

De productiebuild bevat `public/data/benelux_network.json`: de gecontroleerde, statische knooppunten- en verbindingsdataset. De browser registreert die bij het opstarten lokaal. De datadialoog toont hoeveel knooppunten en verbindingen lokaal beschikbaar zijn en biedt de mogelijkheid de browsercache te wissen.

De kaartachtergrond, zoekopdrachten, hoogtegegevens en eventuele live-routering hebben nog wel een internetverbinding nodig. Geolocatie is optioneel en wordt alleen gebruikt nadat de browser daarvoor toestemming geeft.

## Lokaal starten

Vereisten: Node.js 20 of hoger en npm.

```bash
git clone https://github.com/MGeurts/fietsroutes.git
cd fietsroutes
npm install
npm run dev
```

De ontwikkelserver luistert standaard op `http://localhost:3000`.

## Controle en productiebuild

```bash
# Typecontrole
npm run lint

# Dataset- en routeregressietests
npm run test

# Statische productiebuild in dist/
npm run build

# Lokale controle van de productiebuild
npm run preview
```

`npm run clean` is uitsluitend handig in een POSIX-shell, omdat het `rm -rf` gebruikt.

## Netwerkdataset bijwerken

De bestaande dataset wordt in Git bijgehouden. Alleen wanneer de OSM-bronnen opnieuw moeten worden verwerkt, voer je lokaal of via de handmatige GitHub Actions-workflow **Build official cycle-network dataset** het volgende uit:

```bash
npm run build:network
```

Dit proces vereist `osmium-tool` en downloadt de Geofabrik-extracten voor België en Nederland. Het schrijft daarna:

- `public/data/benelux_network.json` — knooppunten, verbindingen en gecontroleerde geometrie;
- `public/data/benelux_network_validation.json` — validatierapport met de herkomst en status van relaties.

Om eerder gedownloade extracten te hergebruiken, stel je `NETWORK_PBF_DIR` in op de map met `belgium-latest.osm.pbf` en `netherlands-latest.osm.pbf`.

### Windows

De fout `spawn osmium ENOENT` betekent dat Windows het programma `osmium` niet in `PATH` vindt. Installeer het via [Conda-forge](https://anaconda.org/conda-forge/osmium-tool) (bijvoorbeeld met Miniforge of Anaconda), heropen PowerShell en controleer de installatie:

```powershell
conda install -c conda-forge osmium-tool
osmium --version
npm run build:network
```

Geen Conda beschikbaar? Gebruik dan in GitHub **Actions → Build official cycle-network dataset → Run workflow**. Die handmatige workflow installeert `osmium-tool` op een Ubuntu-runner, bouwt beide datasetbestanden en commit de wijzigingen alleen wanneer de bouw slaagt.

## Publiceren

`npm run build` levert een volledig statische `dist/`-map op. Publiceer de volledige inhoud daarvan op een statische webserver; zorg er vooral voor dat ook `dist/data/` bereikbaar blijft, want daarin staat de ingebouwde netwerkdataset.

De meegeleverde `index.php` kan de opgebouwde app vanuit `dist/` serveren op PHP-hosting of Laravel Herd. Een Node.js-proces is in productie niet nodig.

## Externe diensten

- [OpenStreetMap](https://www.openstreetmap.org/) voor kaart- en knooppuntgegevens.
- [CyclOSM](https://www.cyclosm.org/), [Waymarked Trails](https://cycling.waymarkedtrails.org/) en optioneel [OpenCycleMap](https://www.opencyclemap.org/) voor fietsgerichte kaartlagen.
- [BRouter](https://brouter.de/) en OpenStreetMap fietsroutering als duidelijk gemarkeerde live-fallbacks.
- [Open-Meteo](https://open-meteo.com/) voor hoogtegegevens.

## Licentie

Dit project is beschikbaar onder de [MIT-licentie](LICENSE). Kaartgegevens © [OpenStreetMap-bijdragers](https://www.openstreetmap.org/copyright), beschikbaar onder ODbL.

## 💖 Steun dit project

Onderhoud en verdere ontwikkeling kosten tijd. Wil je Fietsroute Planner steunen, dan kan dat via [PayPal](https://www.paypal.me/MGeurtsKREAWEB) of [Buy Me a Coffee](https://buymeacoffee.com/MGeurts). Dank je wel!
