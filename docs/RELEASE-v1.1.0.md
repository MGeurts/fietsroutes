# Fietsroutes Vlaanderen v1.1.0

Nieuwe minorrelease met uitgebreidere navigatie, éénrichtingstrajecten en routeoverdracht via QR-code. Deze release bundelt de wijzigingen sinds v1.0.2.

## Eénrichtingstrajecten

- 80 bruikbare éénrichtingstrajecten toegevoegd: het netwerk bevat nu 7.655 beschikbare trajecten, naast 5.002 genummerde knooppunten.
- Eénrichting wordt uitsluitend van het officiële beginpunt naar eindpunt gebruikt. Null of lege richtingscode blijft tweerichting; onbekende codes en tegenstrijdige geometrie worden uitgesloten.
- De bestaande broncache is opnieuw verwerkt op 23 november 2026, zonder nieuwe WFS-download. Van 90 éénrichtingsbronrecords zijn 80 bruikbaar; de andere 10 vallen af door aansluitings- of geometrieproblemen. In totaal blijven 85 brontrajecten uitgesloten.
- De rondritgenerator berekent terugwegen afzonderlijk en keert geen gecachte éénrichtingspaden om.
- Route omkeren berekent volgens toegestane rijrichtingen. Een terugweg kan anders of langer zijn; als die ontbreekt, blijft de huidige werkroute behouden.

## Navigatie op de mobiele telefoon

- De kaart volgt je positie en draait standaard met de rijrichting bovenaan. Een ronde icoonknop boven centreren schakelt tussen rijrichting en noorden bovenaan.
- Richting komt uit de GPS-koers of voldoende betrouwbare verplaatsing. Koerswijzigingen worden gedempt; bij stilstand of slechte GPS blijft de laatste bruikbare richting behouden. Zonder bekende koers staat noord bovenaan.
- De positiestip is tijdens navigatie groter en rood, met een witte rand en schaduw. De lichtroze omringende cirkel wordt visueel tweemaal zo breed getekend; dit verandert de gemeten GPS-nauwkeurigheid niet.
- De witte hoofding toont op één rij het volgende knooppunt, de afstand ernaartoe en het daaropvolgende knooppunt. Herhaalde bezoeken aan hetzelfde knooppunt worden per bezoek verwerkt.
- De groene onderbalk toont met iconen de actuele snelheid, resterende afstand en geschatte aankomsttijd (ETA), in die volgorde. Een compacte vierkante stopknop vervangt de brede tekstknop.
- Actuele snelheid gebruikt GPS-snelheid, met terugval op recente betrouwbare verplaatsingen. Ontbrekende of onbetrouwbare waarden worden niet als geldige metingen getoond.
- ETA is gebaseerd op de resterende afstand en het gekozen fietsprofiel; pauzes worden niet meegerekend. Zonder bruikbare GPS of bij routeafwijking wordt geen ETA getoond.
- GPS-, afwijkings- en aankomstmeldingen blijven beschikbaar. Overbodige instructietekst is ingekort.

## Route delen met QR-code

- Delen opent een lokaal gegenereerde QR-code en een kopieerbare publieke link. De link verwijst naar https://fietsroutes.kreaweb.be/, ook wanneer je lokaal via Flock werkt.
- De QR-code bevat de gekozen knooppunten én de routenaam, met correcte verwerking van accenten, spaties en bijzondere tekens. Open op de mobiele telefoon en kies Bewaren om de route daar op te slaan.
- Link kopiëren en, indien ondersteund, Deel link blijven beschikbaar. Bij geweigerde klembordtoegang is de link handmatig selecteerbaar.
- Er wordt geen externe QR-dienst gebruikt. Lange routes krijgen een grotere QR-weergave. De QR-deelmodule wordt pas bij openen geladen en is wel onderdeel van de offlinecache.
- Naam en puntkeuze worden overgenomen; fietsprofiel en bibliotheek worden niet meegestuurd. Het ontvangende apparaat berekent het traject opnieuw op zijn eigen netwerkversie.

## Namen, presentatie en documentatie

- Suggestie naast de routenaam genereert bij een geldige route bijvoorbeeld 534 - Naar 64 - 25,3 km of 534 - Rondrit - 32,2 km. De naam blijft handmatig aanpasbaar.
- De header gebruikt Fietsroutes met hoofdletter; de twee headerknoppen hebben verklarende titels.
- De kaartvermelding is ingekort tot OpenStreetMap en opent in een nieuw tabblad, ook op rondritvooruitzichten.
- Bronvermeldingen staan onder elkaar in README en Over deze app. De appbronlinks openen in nieuwe tabbladen; GitHub kan die instelling voor README-links negeren.
- De term mobiele telefoon vervangt gsm in app en documentatie.
- Gebruikers-, ontwikkelaars-, hosting- en updatedocumentatie bijgewerkt, inclusief samenhang tussen appcode en netwerksnapshot.

## Installeren en bijwerken op Antagonist Slim

Download fietsroutes-antagonist.zip en upload de volledige uitgepakte inhoud naar de documentroot van het HTTPS-domein. Neem .htaccess, sw.js, data en alle assets mee, inclusief de rondritworker en afzonderlijke QR-deelmodule. Installatie onder een extra URL-pad is niet ondersteund. Node.js is niet nodig op de hosting.

Publiceer appcode en dataset samen: alleen network.json vervangen volstaat niet voor éénrichtingsroutering. De GitHub-release voert geen automatische upload naar Antagonist uit. Gebruik na online publicatie de appmelding Bijwerken. Bij een nog vastzittende oude installatie kan eenmaal Ctrl+Shift+R nodig zijn; wis geen sitegegevens zonder routebackup.

Bij verhuizing naar een ander publiek domein moet publicAppUrl in src/domain/sharing.ts worden aangepast en opnieuw worden gebouwd. Lokale ontwikkeling gebeurt met Flock op https://fietsroutes.test, met dist als documentroot en Node.js 26 voor installatie, tests en build.

## Validatie en beperkingen

Alle 93 tests in 26 testbestanden zijn geslaagd, evenals de TypeScript-controle, productiebuild, ZIP-verificatie en lokale HTTPS-/MIME-/documentrootcontrole. Tests omvatten onder meer éénrichtingsverboden en omwegen, behoud bij onmogelijke routeomkering, daadwerkelijke QR-decodering tot 200 punten met routenaam, koersfiltering, echte Leaflet-coördinatentransformatie, actuele snelheid, ETA en knooppuntvolgorde.

GPS-navigatie vereist de app op de voorgrond. Achtergrondnavigatie, gesproken afslagaanwijzingen, automatische omleidingen en automatische synchronisatie tussen apparaten ontbreken. Kaarttegels, nieuwe plaatszoekopdrachten en nieuwe aanrijroutes vereisen internet. Praktijktests op Android en iPhone blijven nodig; de automatische controles vervangen die niet.
