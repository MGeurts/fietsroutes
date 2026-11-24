# Fietsroutes Vlaanderen v1.3.0

24 november 2026. Deze release voegt toeristische informatie langs je route en geplande pauzeplaatsen toe.

## Toeristische plaatsen

- Meegeleverde OpenStreetMap-momentopname met 33.864 plaatsen: overnachtingen, horeca, bezienswaardigheden, toiletten, drinkwater en fietsvoorzieningen. Gegevens kunnen onvolledig of verouderd zijn.
- Toerisme werkt onafhankelijk van de achtergrondkaart. Standaard ingeschakeld met horeca, bezienswaardigheden en voorzieningen, zonder overnachtingen, en alleen binnen 500 meter van de route. Bestaande voorkeuren blijven behouden.
- Categorieën en routefilter via Toerisme-instellingen. Geen aparte toeristische achtergrondkaart meer.
- Vanaf zoomniveau 14 verschijnen aanklikbare iconen met naam, type en beschikbare adres-, website- en openingsgegevens. De losse OpenStreetMap-link en tellerbadge op de kaart zijn verwijderd; de bronvermelding blijft behouden.
- Bezienswaardigheden, openbare toiletten en drinkwaterpunten binnen 50 meter van de route staan op volgorde tussen de knooppunten. De lijst gebruikt dezelfde iconen als de kaart en toont beschikbare namen volledig.
- Een lijstselectie centreert de kaart, opent de details en markeert de plaats vier seconden met een lichtrode cirkel. Routeknooppunten krijgen bij selectie eveneens deze korte markering.

## Tijdens het fietsen

- Toeristische punten uit de routelijst pulseren langzaam lichtrood vanaf 200 meter vóór de passage tot 100 meter erna, gemeten langs de route.
- De bovenste informatiebadge toont hun icoon, naam en afstand of Net voorbij. Meerdere actieve punten staan onder elkaar.
- De markeringen volgen betrouwbare GPS-voortgang en stoppen bij routeafwijking, verouderde GPS of uitgeschakeld Toerisme. Bij een voorkeur voor minder beweging blijft de cirkel statisch.

## Pauzeplaatsen

- Voeg een plaats toe vanuit haar kaartpopup, kies een pauzetijd en bekijk de extra fietsafstand vóór bevestiging.
- BRouter berekent afzonderlijke fietsbare heen- en terugverbindingen vanaf een routeknooppunt. Hiervoor is internet nodig. Zonder geldige verbinding blijft de route behouden.
- Omweg en geplande pauzetijd tellen mee in de afstand en totale tijd. De ETA neemt nog niet gepasseerde pauzes mee; dit is geen automatische pauzetimer.
- Bewaren, automatisch herstel, bibliotheekbackups en GPX behouden pauzeplaatsen en hun verbindingen. Heropenen vereist geen nieuwe BRouter-berekening.
- Routes met pauzeplaatsen delen via GPX. De bestaande QR-deellinks blijven beschikbaar voor routes zonder pauzeplaatsen.

## Kaartbediening en gegevens

- Centreren staat boven het Toerisme-bedieningsblok; instellingen en aan/uit staan onder elkaar in één blok met gelijke afmetingen.
- Kaartlagen staat onder Uitzoomen binnen het zoomblok.
- Netwerkgegevens in Over deze app staan onder elkaar, inclusief toerismeaantal en beide downloaddatums.
- De netwerksnapshot is ververst op 24 november 2026: 5.002 genummerde knooppunten, 7.655 trajecten en 80 éénrichtingstrajecten.
- `npm run data:tourism` vernieuwt de toerismesnapshot. De productieapp bevraagt Overpass niet bij kaartbewegingen.

## Installeren en bijwerken

Download `fietsroutes-antagonist.zip` en upload de volledige uitgepakte inhoud naar de documentroot van het HTTPS-domein. Neem ook `data/tourism.json`, `data/network.json`, `.htaccess`, serviceworker en alle assets mee. Node.js is niet nodig op de hosting. De GitHub-release uploadt niet automatisch naar Antagonist.

Gebruik daarna Bijwerken in de app. Bewaarde routes blijven behouden. Maak voor het wissen van browseropslag altijd eerst een backup. Toerismegegevens zijn na een volledige installatie offline beschikbaar; kaarttegels, websites en het berekenen van nieuwe pauzeverbindingen vereisen internet.
