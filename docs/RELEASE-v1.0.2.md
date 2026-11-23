# Fietsroutes Vlaanderen v1.0.2

Deze release voegt rondritkeuze per windrichting toe, verbetert de zoekresultaten en vereenvoudigt de kaart en routebediening.

## Rondritten met vooruitzicht

- Kies een startknooppunt en een gewenste afstand van 15–80 km. Rondritten voorstellen zoekt één lus per windrichting: Noord, Oost, Zuid en West.
- Elk beschikbaar voorstel toont een kaartvooruitzicht met Start en noordpijl, werkelijke afstand en geschatte fietstijd voor het gekozen fietsprofiel.
- Pas Kies Noord/Oost/Zuid/West vervangt de werkroute. De modal sluiten behoudt de bestaande route.
- De berekening draait in een achtergrondworker met voortgang per onderzochte richting. Een gewijzigde afstand of sluiten stopt de oude berekening.
- Voorstellen volgen uitsluitend beschikbare officiële verbindingen. Maximaal 20% afstandsafwijking en 15% dubbel bereden trajectlengte worden toegestaan. Het naar trajectlengte gewogen middelpunt bepaalt de richting ten opzichte van de Start.
- Als geen passende lus wordt gevonden, verschijnt dat bij die richting. Vier beschikbare voorstellen kunnen niet voor ieder startpunt en iedere afstand worden gegarandeerd.
- De berekening werkt lokaal en de worker wordt voor offline gebruik meegenomen. Voor de achtergrondkaarten van de vooruitzichten is internet nodig.

## Zoeken

- Gelijke knooppuntnummers worden op afstand tot het huidige kaartcentrum gesorteerd vóór weergave. Zo staat knooppunt 64 in Limburg bovenaan wanneer de kaart rond Zutendaal staat.
- Alle gevonden lokale knooppunten en alle ontvangen plaatsresultaten staan in een scrollbare lijst. Hiervoor worden geen extra plaatszoekaanvragen uitgevoerd.

## Kaart en bediening

- Leaflet en de netwerkbronvermelding zijn van de kaart naar de infomodal verplaatst. Verplichte OpenStreetMap-attributie blijft zichtbaar, evenals CyclOSM bij die achtergrond.
- Routeknoppen staan in drie rijen: Bewaren en Delen; GPX Export en GPX Import; Strookje en Nieuwe route.
- De netwerkopmerking is verwijderd van het afdrukstrookje.
- De rondritmodal gebruikt de kortere tekst en hoofdletters in de windrichtingsknoppen.
- Versienummer 1.0.2 in header, informatiemodal en HTML-metadata; documentatie bijgewerkt.

## Installeren op Antagonist Slim

Download fietsroutes-antagonist.zip en upload de volledige uitgepakte inhoud naar de documentroot van het HTTPS-domein. Neem .htaccess, sw.js, alle assets (inclusief de nieuwe worker), data en overige buildbestanden mee. Node.js is niet nodig op de hosting. Installatie onder een extra URL-pad is niet ondersteund.

De GitHub-release uploadt niet automatisch naar Antagonist. De app meldt een beschikbare update nadat de nieuwe build online staat. Gebruik Bijwerken; bij een nog vastzittende oudere installatie kan eenmaal Ctrl+Shift+R als herstelstap nodig zijn. Wis geen sitegegevens: bewaarde routes staan lokaal op het apparaat en webadres.

## Gegevens en beperkingen

De netwerksnapshot blijft die van 21 november 2026: 5.002 genummerde knooppunten en 7.575 bruikbare trajecten. Er is geen nieuwe bronimport uitgevoerd. Sommige officiële trajecten zijn uitgesloten. GPS werkt op de voorgrond; gesproken instructies, achtergrondnavigatie en externe GPX-koppeling ontbreken. Kaarttegels, nieuwe plaatszoekopdrachten en aanrijroutes vereisen internet. Praktijktests op Android en iPhone blijven nodig.

## Validatie

69 geautomatiseerde tests, waaronder vier verschillende geldige lussen rond Zutendaal, richtings- en afstandscontrole, routecontinuïteit, zoeken in de echte snapshot, expliciete rondritkeuze en annulering van verouderde resultaten. Verder: TypeScript-controle, productiebuild, ZIP-verificatie en lokale HTTPS-/MIME-/documentrootcontrole.
