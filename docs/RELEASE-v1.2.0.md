# Fietsroutes Vlaanderen v1.2.0

24 november 2026. Deze release verbetert het routeblad en het bewaren en openen van routes.

## Routeblad en rondritten

- Compactere hoofding, routegegevens en fietskeuze geven meer ruimte aan de knooppuntenlijst.
- De knooppuntenbalk met actieknoppen blijft zichtbaar tijdens scrollen, zonder horizontale scrollbar op smalle schermen.
- Het aantal bewaarde routes blijft ook op mobiele schermen zichtbaar in de bibliotheekknop.
- Zonder startpunt verschijnt de instructie in de rondritkiezer in rood.
- De naam van een gekozen rondrit bevat opnieuw de windrichting, bijvoorbeeld `29 - Rondrit Noord 82,6 km`.

## Bewaren en bibliotheek

- Groen ✓ Bewaard op dit apparaat of amber ● Niet bewaard bij de routenaam.
- De bewaarknop toont Bewaren, Wijzigingen bewaren of een uitgeschakelde ✓ Bewaard; na opslaan verschijnt een bevestiging.
- Bij het vervangen of leegmaken van een niet bewaarde route kun je bewaren, verwerpen of annuleren. De huidige routenaam staat duidelijk onder de dialoogtitel. Bij een opslagfout blijft de route behouden.
- Alleen het vereiste startpunt van een nieuwe rondrit veroorzaakt geen waarschuwing. Bewerkingen aan een bestaande bibliotheekroute blijven beschermd.
- Het fietsprofiel wordt met de route opgeslagen en hersteld. Oudere routes en backups blijven leesbaar en gebruiken standaard E-bike · 20 km/u als het profiel ontbreekt.
- Mijn routes toont per route een fietsicoon en fietstype. De geopende route krijgt een groen accent met ✓ Geopend.

## Installeren en bijwerken

Download `fietsroutes-antagonist.zip` en upload de volledige uitgepakte inhoud naar de documentroot van het HTTPS-domein, inclusief `.htaccess`, serviceworker, data en assets. Node.js is niet nodig op de hosting. De GitHub-release uploadt niet automatisch naar Antagonist.

Gebruik daarna de appmelding Bijwerken. Bewaarde routes blijven behouden. Wis geen browseropslag zonder backup. Netwerkgegevens en externe diensten zijn ongewijzigd.
