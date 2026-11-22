# Gebruikershandleiding

## Starten en de kaart bedienen

Open de app en geef de browser toestemming voor je locatie. Bij elke start vraagt de app een verse GPS-locatie op en centreert de kaart bij de eerste fix. De blauwe stip toont je positie; de kring geeft de gemelde nauwkeurigheid weer. Zonder toestemming kun je nog steeds routes plannen via de kaart of het zoekvak.

Rechts op de kaart staan, van boven naar beneden:

1. Het vizier: centreert op je locatie en vraagt opnieuw een locatiebepaling aan.
2. De zoomselector: toont het actuele niveau, met knoppen voor in- en uitzoomen. Het niveau verandert ook mee bij zoomen op de kaart.
3. De kaartlagenknop: opent de keuze van de achtergrondkaart.

De kaartlagen staan in deze volgorde:

| Kaart | Weergave |
| --- | --- |
| Standard (OSM) | De gewone OpenStreetMap-achtergrond. |
| OSM + Fietsnetwerk | Standaardkeuze; OSM met duidelijk zichtbare rode lijnen van het beschikbare officiële netwerk. |
| CyclOSM | Fietsgerichte achtergrond met fietsinfrastructuur en reliëf. |

Zoek op een plaatsnaam, knooppuntnummer of netwerknaam. Voor plaatsen zijn minstens twee letters en internet nodig. Hoofdletters maken geen verschil; ook kleinere gemeenten zoals Zutendaal worden opgezocht. Klik op een resultaat om de kaart daar te centreren; daarmee voeg je nog geen punt toe aan je route.

## Een route plannen

Klik op een genummerd knooppunt om de Start te kiezen. Kies vervolgens andere knooppunten op de kaart. De app zoekt de kortste aaneengesloten verbindingen in het beschikbare officiële netwerk en neemt de nodige automatische tussenpunten op. De blauwe lijn toont de geplande route.

De lijst **Knooppunten** toont elk genummerd bezoek in rijvolgorde. Een knooppunt kan vaker voorkomen, ook met hetzelfde nummer. Dat kan een herhaald bezoek of een afzonderlijk bronpunt met hetzelfde nummer zijn.

| Rol | Markering |
| --- | --- |
| Start | Groen, met hoekige vorm. |
| Manueel tussenpunt | Blauwe, gevulde cirkel; in de lijst aangeduid als Via. |
| Automatisch tussenpunt | Lichtblauwe cirkel met gestippelde rand. |
| Einde | Rood vierkant. |

De kaart, lijst en volledige knooppuntvolgorde gebruiken dezelfde stijlen. Bij een rondrit worden Start en Einde apart in de lijst getoond; hun gedeelde positie op de kaart krijgt een groen-rode marker.

Onder ieder punt behalve het laatste staan de fietsafstand en geschatte tijd tot het volgende genummerde punt. Eventuele ongenummerde verbindingspunten tellen mee in die afstand. Het standaard fietsprofiel is **E-bike · 20 km/u**. Een ander profiel verandert de tijdsinschatting, niet het berekende traject. De tijd houdt geen rekening met pauzes, verkeer of persoonlijke fietssnelheid.

Klik op een punt in de lijst om het op de kaart te bekijken. Het kruisje verwijdert een gekozen punt en berekent de route opnieuw. Automatische punten hebben geen kruisje: ze volgen uit de verbindingen tussen je gekozen punten.

## Je werkroute behouden

De app bewaart de huidige werkroute automatisch op dit apparaat, inclusief naam, gekozen punten, fietsprofiel, kaartlaag en eventuele koppeling met een bibliotheekroute. Na herladen wordt deze hersteld. Dit vervangt Bewaren in de bibliotheek niet. Bij afsluiten met niet in de bibliotheek bewaarde wijzigingen kan je browser daarnaast een bevestiging tonen.

Een deellink heeft bij openen voorrang op een herstelkopie. Zodra de link is ingelezen, wordt het routegedeelte uit de adresbalk verwijderd, zodat na verdere bewerkingen de actuele werkroute wordt hersteld bij herladen. Klikken op het logo opent de kaart zonder de route te wissen. Nieuwe route en Route verwijderen maken de herstelkopie bewust leeg. De herstelkopie is lokaal en bevat geen GPS-locatie.

Bij een nieuwe appversie verschijnt een melding met Bijwerken en Later. Bijwerken activeert de nieuwe appversie die de browser op de achtergrond heeft gedownload. Eerst wordt de werkroute bewaard; daarna neemt de nieuwe serviceworker de pagina over en herstart de app. Na maximaal 15 seconden zonder overname verschijnt een foutmelding en kun je opnieuw proberen. Bewaarde bibliotheekroutes blijven behouden. Deze knop haalt geen nieuwe brondata op; bij opslagproblemen wordt de update geblokkeerd. Tijdens navigatie is de updateknop uitgeschakeld. Het actuele versienummer staat links van de infoknop.

## Routeknoppen

Naast de titel **Knooppunten** staan:

| Knop | Werking |
| --- | --- |
| Ongedaan maken / Opnieuw | Gaat terug of vooruit in de bewerkingen van de puntkeuze. |
| Volledige route centreren | Toont het hele geplande traject op de kaart. Op een gsm opent dit ook het kaartscherm. |
| Route omkeren | Keert de gekozen puntvolgorde om en berekent de verbindingen opnieuw. |
| Route verwijderen | Maakt de werkroute leeg; herstel is mogelijk via Ongedaan maken. Een opgeslagen route in de bibliotheek blijft bestaan. |

**Nieuwe route** maakt eveneens de werkroute leeg en zet de naam terug op Mijn fietsroute. Tijdens het fietsen zijn routebewerkingen uitgeschakeld.

## Rondritten

Kies een startknooppunt en klik op **Maak er een rondrit van**. Stel een gewenste afstand van 15 tot 80 km in en kies **Rondrit voorstellen**. De generator probeert een lus met weinig dubbel bereden trajecten te vinden. Het resultaat kan van de gevraagde afstand afwijken; als geen geschikte lus beschikbaar is, verschijnt een melding.

De standaardnaam bevat het startnummer en de berekende lengte, bijvoorbeeld `535 - Rondrit 32,2 km`. Je kunt deze naam aanpassen. Bij latere routebewerkingen wordt een bestaande naam niet automatisch bijgewerkt; de afstandsweergave toont wel de opnieuw berekende lengte.

## Aanrijroute naar de Start

Zodra je locatie en een startpunt bekend zijn, wordt een fietsaanrijroute via BRouter berekend. Die verschijnt als bruin gestippelde lijn, ook bij geopende routes uit de bibliotheek, GPX of deellinks. Een gewijzigd startpunt of minstens 50 meter verplaatsing veroorzaakt een nieuwe berekening. Binnen 25 meter van de start verdwijnt de aanrijlijn. Tijdens navigatie blijft de aanrijrouteberekening vervolgens uitgeschakeld, ook wanneer je verder van de start wegfietst. Dit gebeurt eveneens zodra de GPS-voortgang bevestigt dat je de route volgt. Na het stoppen van de navigatie kan bij plannen weer een aanrijroute worden berekend.

Deze aanrijroute volgt fietsbare wegen uit OpenStreetMap en hoeft niet over het knooppuntennetwerk te lopen. Ze telt niet mee in de routeafstand, GPX-export of het strookje. Berekening vereist internet; je locatie en het startpunt worden naar BRouter gestuurd. Als berekening niet lukt, wordt geen rechte lijn als vervanging getoond.

## Bewaren en de bibliotheek

Geef de route een naam en kies **Bewaren**. Open de bibliotheek via **Mijn routes**. Daar kun je zoeken, favorieten instellen, routes openen en routes verwijderen. Iedere route toont het aantal gekozen punten en de lokale datum en tijd van de laatste bewaring. Automatische punten worden bij openen opnieuw berekend.

Na het openen van een bewaarde route verandert Bewaren in **Bijwerken**. Daarmee overschrijf je die route. **Als nieuwe kopie bewaren** maakt een aparte route met een volgnummer: `(kopie 1)`, `(kopie 2)`, enzovoort. Ook bij een kopie van een kopie loopt de nummering door. De nieuwe kopie wordt daarna de actieve route. Bestaande gelijknamige routes worden niet achteraf hernoemd.

Routes staan in de browseropslag van dit apparaat en dit webadres. Een andere browser, een ander adres of het wissen van sitegegevens geeft dus een andere of lege bibliotheek. Maak een JSON-backup voordat je sitegegevens verwijdert. Het verwijderen van een bibliotheekroute vraagt bevestiging; er is geen prullenmand.

## GPX, backups, delen en afdrukken

- **GPX export** downloadt het traject en de gekozen knooppunt-ID's. Een komma in de naam blijft behouden, bijvoorbeeld `535 - Rondrit 32,2 km.gpx`.
- **Importeren** opent GPX uit deze app of een JSON-bibliotheekbackup. GPX van andere apps aan het netwerk koppelen wordt nog niet ondersteund.
- **Backup downloaden** in Mijn routes bewaart de bibliotheek als JSON. Backupimport voegt routes toe zonder bestaande te overschrijven en slaat identieke naam/puntcombinaties over.
- **Delen** gebruikt de deelmogelijkheden van je apparaat of kopieert een link. De link bevat de gekozen knooppunten; de ontvanger moet dezelfde app op een bereikbaar adres kunnen openen. Een lokaal `.test`-adres is niet zomaar vanaf andere apparaten bereikbaar.
- **Strookje** opent afdrukken met de volledige genummerde knooppuntvolgorde.

GPX-herimport, bibliotheekroutes en deellinks worden op de aanwezige netwerkversie opnieuw berekend. Een JSON-backup bevat gekozen punten, namen, favorieten en bewaartijden, geen historische trajectgeometrie of fietsprofiel.

## Fietsen en offline gebruik

Kies **Start met fietsen** voor GPS-volging, het volgende knooppunt en de resterende routeafstand. Houd de app op de voorgrond. De app probeert het scherm wakker te houden als je browser dit ondersteunt. Bij onnauwkeurige GPS of afwijken verschijnt een melding; er wordt geen omleiding buiten het knooppuntennetwerk berekend.

Installeer de app eventueel via Toevoegen aan beginscherm in je browser. Na de eerste volledige online installatie van de productieversie zijn appbestanden, netwerkgegevens en lokale routes offline bruikbaar. Achtergrondkaarten, nieuwe plaatszoekopdrachten en nieuwe aanrijrouteberekeningen vereisen internet.

Achtergrondnavigatie, gesproken afslagaanwijzingen en automatische synchronisatie tussen apparaten zijn nog niet beschikbaar. Deze versie moet nog op de fiets worden getest. Het netwerk bevat bovendien uitgesloten trajecten; volg onderweg ook de bewegwijzering en controleer de geplande route vooraf.

Bij een verouderde weergave: herlaad de app, op een computer zo nodig met Ctrl+Shift+R. Wis de sitegegevens niet als oplossing zonder eerst je bibliotheek te exporteren.
