# Gebruikershandleiding

## Starten en de kaart bedienen

Open de app en geef de browser toestemming voor je locatie. Bij elke start vraagt de app een verse GPS-locatie op en centreert de kaart bij de eerste fix. Tijdens het plannen toont de blauwe stip je positie; de kring geeft de gemelde GPS-nauwkeurigheid weer. Tijdens navigatie is de stip rood en wordt de omringende cirkel visueel tweemaal zo breed en lichtroze weergegeven. Zonder toestemming kun je nog steeds routes plannen via de kaart of het zoekvak.

De header toont **Fietsroutes**, het versienummer en twee knoppen: informatie (**Over deze app**) en de bibliotheek (**Bewaarde routes**). Op een smal scherm kunnen de knoppen alleen als icoon verschijnen.

Rechts op de kaart staan tijdens het plannen, van boven naar beneden:

1. Het vizier: centreert op je locatie en vraagt opnieuw een locatiebepaling aan.
2. Het Toerisme-bedieningsblok: instellingen bovenaan, toerisme aan/uit eronder. Beide knoppen zijn even groot en staan onder elkaar.
3. Het zoom- en kaartlagenblok: actueel niveau, inzoomen, uitzoomen en daaronder Kaartlagen in één blok. Het niveau verandert mee bij zoomen op de kaart.

Tijdens navigatie staat boven het vizier een even grote ronde richtingknop zonder tekst. Het navigatiepijltje betekent rijrichting bovenaan; het kompas betekent noorden bovenaan. De verklarende titel en toegankelijkheidsnaam geven de actieve stand aan.

De kaartlagen staan in deze volgorde:

| Kaart | Weergave |
| --- | --- |
| Standard (OSM) | De gewone OpenStreetMap-achtergrond. |
| OSM + Fietsnetwerk | Standaardkeuze; OSM met duidelijk zichtbare rode lijnen van het beschikbare officiële netwerk. |
| CyclOSM | Fietsgerichte achtergrond met fietsinfrastructuur en reliëf. |

Zoek op een plaatsnaam, knooppuntnummer of netwerknaam. Voor plaatsen zijn minstens twee letters en internet nodig. Hoofdletters maken geen verschil; ook kleinere gemeenten zoals Zutendaal worden opgezocht. Alle lokale knooppuntresultaten en alle ontvangen plaatsresultaten verschijnen in een scrollbare lijst, zonder extra zoekaanvragen. Bij gelijke knooppuntnummers staan de punten dichtst bij het huidige kaartcentrum bovenaan. Verschuif de kaart om in een andere regio te zoeken. Klik op een resultaat om de kaart daar te centreren; daarmee voeg je nog geen punt toe aan je route.

## Een route plannen

Klik op een genummerd knooppunt om de Start te kiezen. Kies vervolgens andere knooppunten op de kaart. De app zoekt de kortste aaneengesloten verbindingen in het beschikbare officiële netwerk en neemt de nodige automatische tussenpunten op. De blauwe lijn toont de geplande route. Eénrichtingstrajecten worden alleen in de toegestane richting gebruikt.

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

## Bewaarstatus en veilig wisselen

Onder de routenaam verschijnt **● Niet bewaard** in amber of **✓ Bewaard op dit apparaat** in groen. De bewaarknop toont Bewaren, Wijzigingen bewaren of een uitgeschakelde ✓ Bewaard. Na bewaren verschijnt een bevestiging. Wijzigingen aan naam, puntkeuze of fietsprofiel maken de route opnieuw niet bewaard.

Bij een andere route openen, een rondrit kiezen, GPX importeren of de werkroute leegmaken vraagt de app eerst wat met niet bewaarde wijzigingen moet gebeuren: **Annuleren**, **Verwerpen** of **Bewaren en doorgaan**. De dialoog toont de naam van de huidige route. Mislukt bewaren, dan blijft de huidige route behouden. Alleen een nieuw startpunt kiezen activeert deze waarschuwing niet; wijzigingen aan een bestaande bibliotheekroute blijven wel beschermd.

Het fietsprofiel wordt met de route bewaard en bij openen hersteld. Oude routes zonder profiel openen als E-bike · 20 km/u. In Mijn routes staat het fietstype met een icoon; de geopende route heeft een groen accent en ✓ Geopend. De bibliotheekknop toont ook op smalle schermen het aantal bewaarde routes.

Het routeblad heeft een compacte hoofding. De rij Knooppunten met actieknoppen blijft zichtbaar bij het scrollen.

## Routeknoppen

Naast de titel **Knooppunten** staan:

| Knop | Werking |
| --- | --- |
| Ongedaan maken / Opnieuw | Gaat terug of vooruit in de bewerkingen van de puntkeuze. |
| Volledige route centreren | Toont het hele geplande traject op de kaart. Op een mobiele telefoon opent dit ook het kaartscherm. |
| Route omkeren | Keert de gekozen puntvolgorde om en berekent de verbindingen opnieuw in de toegestane rijrichtingen. De terugweg kan anders of langer zijn; zonder geldige terugweg blijft de huidige route behouden en verschijnt een melding. |
| Route verwijderen | Maakt de werkroute leeg en zet de naam terug op Mijn fietsroute; de puntkeuze herstellen is mogelijk via Ongedaan maken. Een opgeslagen route in de bibliotheek blijft bestaan. |

Onder de rondritknop staan de acties in drie rijen: **Bewaren/Wijzigingen bewaren · Delen**, **GPX Export · GPX Import** en **Strookje · Nieuwe route**.

**Nieuwe route** maakt eveneens de werkroute leeg en zet de naam terug op Mijn fietsroute. Tijdens het fietsen zijn routebewerkingen uitgeschakeld.

## Rondritten

Kies een startknooppunt en klik op **Maak er een rondrit van**. Stel een gewenste afstand van 15 tot 80 km in en kies **Rondritten voorstellen**. De app berekent op de achtergrond één voorstel per windrichting: noord, oost, zuid en west. De voortgang verschijnt per onderzochte richting. Elk beschikbaar voorstel toont een kaartvooruitzicht, de werkelijke afstand en de geschatte fietstijd voor je fietsprofiel. Kies een voorstel met **Kies Noord/Oost/Zuid/West**; pas dan vervangt het je werkroute. Sluiten van de modal behoudt de bestaande route.

Een voorstel mag maximaal 20% van de gevraagde afstand afwijken en maximaal 15% dubbel bereden trajectlengte bevatten. De richting wordt bepaald door het naar trajectlengte gewogen middelpunt van de lus ten opzichte van de Start. Door de vorm en de beschikbaarheid van het officiële netwerk kan een richting geen geschikte lus opleveren; dan verschijnt bij die richting een melding. Een gewijzigde afstand annuleert de vorige berekening en wist de oude voorstellen. De routeberekening zelf werkt lokaal; de achtergrondkaarten in de vooruitzichten vereisen internet.

De standaardnaam bevat het startnummer, de gekozen windrichting en de berekende lengte, bijvoorbeeld `535 - Rondrit Noord 32,2 km`. Je kunt deze naam aanpassen. Bij latere routebewerkingen wordt een bestaande naam niet automatisch bijgewerkt; de afstandsweergave toont wel de opnieuw berekende lengte.

## Aanrijroute naar de Start

Zodra je locatie en een startpunt bekend zijn, wordt een fietsaanrijroute via BRouter berekend. Die verschijnt als bruin gestippelde lijn, ook bij geopende routes uit de bibliotheek, GPX of deellinks. Een gewijzigd startpunt of minstens 50 meter verplaatsing veroorzaakt een nieuwe berekening. Binnen 25 meter van de start verdwijnt de aanrijlijn. Tijdens navigatie blijft de aanrijrouteberekening vervolgens uitgeschakeld, ook wanneer je verder van de start wegfietst. Dit gebeurt eveneens zodra de GPS-voortgang bevestigt dat je de route volgt. Na het stoppen van de navigatie kan bij plannen weer een aanrijroute worden berekend.

Deze aanrijroute volgt fietsbare wegen uit OpenStreetMap en hoeft niet over het knooppuntennetwerk te lopen. Ze telt niet mee in de routeafstand, GPX-export of het strookje. Berekening vereist internet; je locatie en het startpunt worden naar BRouter gestuurd. Als berekening niet lukt, wordt geen rechte lijn als vervanging getoond.

## Bewaren en de bibliotheek

Geef de route een naam en kies **Bewaren**. Zodra een geldige route met begin- en eindpunt bestaat, kun je naast de naam **Suggestie** kiezen. Dit vervangt de naam door bijvoorbeeld `534 - Naar 64 - 25,3 km` of `534 - Rondrit - 32,2 km`. De suggestie gebruikt de actuele afstand en voegt geen externe zoekaanvragen toe. Je kunt de naam nadien zelf aanpassen. Tijdens navigatie is de knop uitgeschakeld. Open de bibliotheek via **Mijn routes**. Daar kun je zoeken, favorieten instellen, routes openen en routes verwijderen. Iedere route toont het aantal gekozen punten en de lokale datum en tijd van de laatste bewaring. Automatische punten worden bij openen opnieuw berekend.

Na het openen van een bewaarde route verandert Bewaren in **Bijwerken**. Daarmee overschrijf je die route. **Als nieuwe kopie bewaren** maakt een aparte route met een volgnummer: `(kopie 1)`, `(kopie 2)`, enzovoort. Ook bij een kopie van een kopie loopt de nummering door. De nieuwe kopie wordt daarna de actieve route. Bestaande gelijknamige routes worden niet achteraf hernoemd.

Routes staan in de browseropslag van dit apparaat en dit webadres. Een andere browser, een ander adres of het wissen van sitegegevens geeft dus een andere of lege bibliotheek. Maak een JSON-backup voordat je sitegegevens verwijdert. Het verwijderen van een bibliotheekroute vraagt bevestiging; er is geen prullenmand.

## GPX, backups, delen en afdrukken

- **GPX Export** downloadt het traject en de gekozen knooppunt-ID's. Een komma in de naam blijft behouden, bijvoorbeeld `535 - Rondrit Noord 32,2 km.gpx`.
- **GPX Import** opent GPX uit deze app of een JSON-bibliotheekbackup. GPX van andere apps aan het netwerk koppelen wordt nog niet ondersteund.
- **Backup downloaden** in Mijn routes bewaart de bibliotheek als JSON. Backupimport voegt routes toe zonder bestaande te overschrijven en slaat identieke naam/puntcombinaties over.
- **Delen** opent een QR-code die je met de camera van je mobiele telefoon kunt scannen. De QR-code en de kopieerbare link gebruiken altijd `https://fietsroutes.kreaweb.be/`, ook als je op de laptop via Flock werkt. Open de link op je mobiele telefoon en kies daar **Bewaren**. **Link kopiëren** en, indien ondersteund, **Deel link** zijn eveneens beschikbaar. De QR-code wordt volledig lokaal gemaakt, zonder externe QR-dienst. De routenaam en gekozen knooppunten worden overgedragen; fietsprofiel en bibliotheek worden niet meegestuurd. De route wordt op de netwerkversie van de ontvanger opnieuw berekend.
- **Strookje** opent afdrukken met de routenaam, afstand, datum en volledige genummerde knooppuntvolgorde. Er staat geen netwerkopmerking onder het strookje.

GPX-herimport, bibliotheekroutes en deellinks worden op de aanwezige netwerkversie opnieuw berekend. Een JSON-backup bevat gekozen punten, namen, favorieten en bewaartijden, geen historische trajectgeometrie of fietsprofiel.

## Fietsen en offline gebruik

Kies **Start met fietsen** voor GPS-volging. Het zoekvak verdwijnt en routebewerkingen worden uitgeschakeld. De witte hoofding toont op één rij het volgende knooppunt, de afstand ernaartoe en het daaropvolgende knooppunt. De groene onderbalk toont met iconen, van links naar rechts, de actuele snelheid (km/u), resterende afstand (km) en geschatte aankomsttijd. De compacte vierkante stopknop rechts beëindigt de navigatie. Waarschuwingen voor GPS of routeafwijking blijven in de hoofding zichtbaar.

Snelheid komt uit de GPS, met een terugval op recente betrouwbare verplaatsingen als de browser geen snelheid levert. Onbetrouwbare of ontbrekende snelheid wordt als een streepje getoond. De ETA is een schatting op basis van de resterende routeafstand en het gekozen fietsprofiel, inclusief de geplande tijd van nog niet gepasseerde pauzeplaatsen. Bij ontbrekende/onnauwkeurige GPS of routeafwijking verschijnt geen ETA. Tijdens navigatie is je positie een grotere rode stip met witte rand. De lichtroze cirkel rond de rode stip wordt voor zichtbaarheid tweemaal zo breed getekend; de gemeten GPS-nauwkeurigheid en de waarschuwingsdrempels veranderen hierdoor niet. De kaart volgt je positie op zoomniveau 16 en draait standaard met je rijrichting bovenaan. De ronde richtingknop boven het centreervizier schakelt tussen rijrichting en noorden bovenaan. Hij toont alleen het navigatiepijltje of kompas; er staat geen tekst in de knop. In de Noord-stand blijft het noorden bovenaan; buiten navigatie staat de kaart eveneens met het noorden bovenaan.

De rijrichting komt uit de GPS-koers wanneer beschikbaar, of uit voldoende verplaatsing tussen nauwkeurige GPS-fixes. Tot een richting bekend is, blijft noord bovenaan. Bij stilstand of slechte GPS wordt de laatste bruikbare richting vastgehouden; kleine koersschommelingen worden gedempt. De oriëntatie volgt je beweging, niet de richting waarin je de telefoon vasthoudt.

Bij het naderen van een genummerd knooppunt schakelt de weergave binnen ongeveer 25 meter door naar het volgende bezoek. Er is geen aparte pieptoon of gesproken aankondiging. Meer dan ongeveer 75 meter van het passende routegedeelte verschijnt een afwijkingsmelding en stopt de voortgang. Bij gemelde GPS-nauwkeurigheid slechter dan 75 meter stopt de voortgang eveneens; na meer dan 20 seconden zonder fix verschijnt Wachten op GPS. Dicht bij het route-einde verschijnt Aangekomen; de navigatie stopt pas met de stopknop.

Houd de app op de voorgrond. De app probeert het scherm wakker te houden als je browser dit ondersteunt. Bij onnauwkeurige GPS of afwijken verschijnt een melding; er wordt geen omleiding buiten het knooppuntennetwerk berekend.

Installeer de app eventueel via Toevoegen aan beginscherm in je browser. Na de eerste volledige online installatie van de productieversie zijn appbestanden, netwerkgegevens en lokale routes offline bruikbaar. Achtergrondkaarten, nieuwe plaatszoekopdrachten en nieuwe aanrijrouteberekeningen vereisen internet.

Achtergrondnavigatie, gesproken afslagaanwijzingen en automatische synchronisatie tussen apparaten zijn nog niet beschikbaar. Deze versie moet nog op de fiets worden getest. Het netwerk bevat bovendien uitgesloten trajecten; volg onderweg ook de bewegwijzering en controleer de geplande route vooraf.

Bij een verouderde weergave: herlaad de app, op een computer zo nodig met Ctrl+Shift+R. Wis de sitegegevens niet als oplossing zonder eerst je bibliotheek te exporteren.


## Toeristische kaartlaag

Klik op **Toerisme**, het informatie-icoon onderaan het Toerisme-bedieningsblok onder de centreerknop. De groene knop betekent dat toeristische informatie aan staat. Nogmaals klikken schakelt ze uit. Dit werkt met iedere achtergrondkaart. Het fietsnetwerk blijft zichtbaar. Vanaf zoomniveau 14 verschijnen aanklikbare iconen voor overnachtingen (B&B/gastenverblijven, hotels, hostels en campings), horeca, musea, attracties, uitkijkpunten, drinkwater, toiletten en fietsherstelpunten. Een popup toont naam, type en beschikbare adres-, telefoon- en websitegegevens zonder afzonderlijke OpenStreetMap-link; de kaart behoudt de bronvermelding. Plaatsen zijn informatiepunten; aanklikken voegt geen routepunt toe.

De laag gebruikt een meegeleverde OpenStreetMap-momentopname van het rechthoekige netwerkgebied met een kleine marge, inclusief plaatsen over de gewest- en landsgrenzen binnen dat gebied. Gegevens kunnen ontbreken of verouderd zijn; openingsuren worden niet weergegeven. De aantallen en downloaddatums staan onder Netwerkgegevens in Over deze app. In drukke gebieden worden iconen uitgedund; zoom verder in voor meer plaatsen. Na volledige installatie zijn de gegevens offline beschikbaar; achtergrondkaarten en externe websites vereisen internet.

Wanneer Toerisme ingeschakeld is, bevat de routelijst ook bezienswaardigheden (uitkijkpunten, attracties en musea) en openbare toiletten en drinkwaterpunten op maximaal 50 meter van het berekende traject. Ze staan tussen de knooppunten in routevolgorde, met hun afstand vanaf de start en tot de route. Aanklikken centreert de kaart. Elk uitkijkpunt verschijnt eenmaal, bij de dichtstbijzijnde passage. Dit zijn informatiepunten: ze voegen geen omweg, gekozen knooppunt of pauzetijd toe. Bij het uitschakelen van Toerisme verdwijnen ze uit de lijst.

Tijdens het fietsen worden de toeristische punten uit de routelijst gemarkeerd met een langzaam pulserende lichtrode cirkel, vanaf 200 meter vóór de passage tot 100 meter erna, gemeten langs de route. Hun icoon en naam verschijnen tegelijkertijd onderaan de bovenste navigatiebadge. Bij meerdere actieve punten staan ze onder elkaar. De markeringen verdwijnen bij het uitschakelen van Toerisme, stoppen van de navigatie, verouderde of onnauwkeurige GPS of routeafwijking. Bij verminderde-bewegingsvoorkeur blijft de cirkel statisch zichtbaar.


## Toerisme instellen en pauzes plannen

De instellingenknop bovenaan het Toerisme-bedieningsblok opent de categoriekeuze: overnachten, eten en drinken, bezienswaardigheden en onderweg. Kies desgewenst Alleen langs mijn route om de kaart tot plaatsen binnen 500 meter van het traject te beperken. Deze voorkeuren blijven op dit apparaat bewaard. Standaard staat Toerisme aan, Overnachten uit en staan de andere categorieën en Alleen langs mijn route aan. Eerder opgeslagen keuzes blijven behouden. De gewone Toerisme-knop blijft een aan/uitknop; rechtsklikken opent eveneens de instellingen.

Een klik op een toeristische plaats in de routelijst centreert de kaart, markeert de plaats kort en opent meteen de details. Tijdens navigatie toont de bovenste badge bij actieve plaatsen ook Over … m of Net voorbij.

Kies in de kaartpopup Als pauzeplaats toevoegen. Kies een pauzetijd (of geen), bekijk de berekende extra afstand en bevestig. De app zoekt het dichtstbijzijnde genummerde knooppunt op de route en berekent afzonderlijk een fietsbare verbinding naar de plaats en terug via BRouter. Dit kan een omweg zijn. Nieuwe verbindingen vereisen internet; er wordt geen rechte lijn verzonnen bij een routeringsfout. Pauzes zijn tijdens het fietsen niet bewerkbaar.

Onder de lijst staan gekozen pauzeplaatsen, de pauzetijd en de geschatte totale tijd inclusief pauzes. Daar kun je een pauzeplaats ook verwijderen. De omweg telt mee in de routeafstand en GPX. Bewaren slaat de plaats, verbindingen en pauzetijd op; ook automatisch herstel en bibliotheekbackups behouden die. Delen van routes met pauzeplaatsen gebeurt via GPX, omdat de bestaande QR-deellink alleen knooppunten bevat. Openen van een bewaarde pauzeroute vereist geen nieuwe BRouter-aanvraag. De ETA bevat de geplande tijd van nog niet gepasseerde pauzeplaatsen; dit is geen automatische pauzetimer.
