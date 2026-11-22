# Fietsroutes Vlaanderen v1.0.0

Eerste publieke release van de volledig opnieuw gebouwde webapp om fietstochten op het officiële Vlaamse knooppuntennetwerk te plannen, bewaren en op een smartphone te volgen.

## Routes plannen

- Kies Start, manuele tussenpunten en Einde op de kaart. De routering volgt de beschikbare officiële verbindingen en hun trajectgeometrie.
- Alle genummerde bezoeken staan in rijvolgorde in de lijst, ook automatisch gekozen tussenpunten. Per volgend punt worden afstand en geschatte fietstijd getoond.
- Herkenbare groene Start, blauwe manuele punten, lichtblauwe gestippelde automatische punten en rood Einde; dezelfde vormgeving op kaart en in beide knooppuntenoverzichten.
- Rondritgenerator voor een gewenste afstand van 15–80 km. Standaardnamen bevatten startnummer en decimale komma, bijvoorbeeld 535 - Rondrit 32,2 km.
- Ongedaan maken/opnieuw, gekozen punten verwijderen, route omkeren, volledige route centreren en werkroute leegmaken.
- E-bike met 20 km/u als standaard; ook stadsfiets, toerfiets en racefiets voor de tijdsinschatting.

## Kaart en GPS

- OpenStreetMap, OSM + Fietsnetwerk (standaard) en CyclOSM via een kaartlagenmodal.
- Locatiebepaling bij opstart, locatiestip met nauwkeurigheidskring, locatiecentrering en zoomselector met actueel zoomniveau.
- Plaatsen zoeken via Photon/OpenStreetMap en lokaal zoeken op knooppuntnummer of netwerknaam.
- Gestippelde fietsaanrijroute via BRouter naar de Start; deze staat los van geplande routeafstand en GPX.
- Fietsmodus met GPS-volging, volgend knooppunt, resterende afstand, afwijkings- en nauwkeurigheidsmeldingen. Schermwakkerhouding waar de browser dit ondersteunt.

## Bewaren en uitwisselen

- Lokale bibliotheek met zoeken, favorieten, bewaartijd, routewijzigingen en genummerde kopieën.
- Automatisch herstel van de werkroute na herladen, inclusief fietsprofiel en kaartlaag.
- JSON-backup en herstel, GPX-export en herimport van eigen GPX, deellinks en afdrukbaar knooppuntenstrookje.
- Geen account of serverdatabase; routes staan op het huidige apparaat en webadres. Exporteer een backup voor overdracht of vóór het wissen van sitegegevens.

## Offline, updates en prestaties

- Installeerbare PWA: appbestanden en netwerksnapshot zijn na volledige eerste installatie offline beschikbaar.
- Online navigaties halen verse HTML op; bij netwerkuitval wordt de geïnstalleerde offlineapp gebruikt.
- De appupdateknop activeert de reeds gedownloade versie, bewaart eerst de werkroute en herstart na controleovername. Bij een fout of na 15 seconden zonder overname wordt opnieuw proberen mogelijk. Tijdens navigatie is bijwerken uitgeschakeld.
- Updatecontrole bij terugkeer naar het tabblad, herstel van de verbinding en ieder uur bij zichtbaar tabblad. Dit importeert geen nieuwe WFS-data.
- Ruimtelijke index en hergebruik van zichtbare kaartobjecten; GPS-updates bouwen de routepuntenlijst niet opnieuw op. Aanrijrouteberekeningen stoppen zodra de rit de Start heeft bereikt of routevoortgang is bevestigd.
- Versienummer zichtbaar links van de infoknop en in de informatiemodal.

## Meegeleverde netwerkgegevens

Snapshot van 21 november 2026: 5.138 netwerkpunten, waarvan 5.002 genummerd, en 7.575 bruikbare trajecten. Bron: Toerisme Vlaanderen en provinciale toeristische organisaties. 165 brontrajecten zijn uitgesloten wegens richting, ontbrekende/onduidelijke aansluiting of ongeldige geometrie. Niet elke officiële verbinding is daardoor routeerbaar.

Verversen gebeurt bewust met npm run data:update: importeren, controleren, testen, bouwen en ZIP vernieuwen. Er is geen periodieke bronimport of automatische hostingupload ingesteld.

## Installatie op Antagonist Slim

Download fietsroutes-antagonist.zip bij deze release en pak de inhoud uit in de documentroot van een eigen domein of subdomein. Neem .htaccess en alle submappen mee. Gebruik de app op de hoofdmap van het domein; installatie onder een extra URL-pad wordt niet ondersteund.

Activeer eerst een geldig HTTPS-certificaat. De Apache-configuratie stuurt HTTP door naar HTTPS en stelt script-MIME-types, cachebeleid en compressie in. Productie vereist geen Node.js, npm, database of achtergrondproces. Deze release publiceert de code en het installatiearchief op GitHub; hij uploadt niet naar Antagonist.

Voor lokale ontwikkeling: Flock met documentroot dist en https://fietsroutes.test, Node.js 26, npm ci, npm test en npm run build. Elke geslaagde build vernieuwt één lokaal archief: releases/fietsroutes-antagonist.zip.

## Validatie en beperkingen

- 61 geautomatiseerde tests geslaagd, inclusief routering, dataset, GPS, zoeken, opslagherstel, puntrollen, exportnamen, kopieën en updateactivatie/timeout.
- TypeScript-controle, productiebuild, ZIP-controle en lokale HTTPS-/MIME-/documentrootcontrole geslaagd.
- Kaarttegels, nieuwe plaatszoekopdrachten en nieuwe aanrijroutes vereisen internet. Er worden geen kaarttegels vooraf gedownload.
- GPS-navigatie werkt op de voorgrond; achtergrondnavigatie, gesproken afslagaanwijzingen, externe GPX-koppeling en synchronisatie ontbreken.
- Praktijktests op de fiets met Android en iPhone blijven nodig. De automatische tests vervangen deze niet.
- Locatie/start worden voor aanrijroutes naar BRouter gestuurd; zoekopdrachten naar Photon en tegelverzoeken naar de geselecteerde kaartprovider.

Zie README.md en docs/GEBRUIK.md, docs/ANTAGONIST.md, docs/ONTWIKKELING.md en docs/UPDATES.md voor gebruik, bronvermelding en onderhoud.
