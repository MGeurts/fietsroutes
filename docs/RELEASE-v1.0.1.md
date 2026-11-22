# Fietsroutes Vlaanderen v1.0.1

Onderhoudsrelease met verbeterde appupdates en herstel van de standaard routenaam.

## Verbeteringen

- Bijwerken activeert de werkelijk wachtende serviceworker en herstart na activatie of controleovername. Een ontbrekend controllerchange-event laat de knop niet meer vastlopen.
- Wanneer een ander tabblad de update al activeerde, herlaadt de knop de actieve installatie in plaats van een foutmelding te geven.
- Na maximaal 15 seconden zonder activatie verschijnt een foutmelding met de concrete oorzaak; opnieuw proberen blijft mogelijk. De werkroute wordt vóór de update bewaard en tijdens navigatie blijft bijwerken uitgeschakeld.
- Route verwijderen zet de naam terug op Mijn fietsroute.
- README met logo, technologie-badges en verduidelijking van dependencybeheer; compatibele dependencyupdates zijn toegestaan via ^-versiebereiken, met reproduceerbare installatie via package-lock.json.
- Gebruikers- en updatedocumentatie bijgewerkt. Versienummer in header, informatiemodal en HTML-metadata is 1.0.1.

## Installeren en bijwerken op Antagonist

Download fietsroutes-antagonist.zip en upload de volledige uitgepakte inhoud naar de documentroot van het HTTPS-domein, inclusief .htaccess, sw.js, data en alle assets. Node.js is niet nodig op Antagonist Slim. Deze GitHub-release uploadt niet automatisch naar de hosting.

Bij overstappen vanaf de versie met de defecte updateknop kan eenmaal Ctrl+Shift+R nodig zijn om de gecorrigeerde appcode te laden. Dit is een herstelstap; voor normale updates is de knop Bijwerken bedoeld. Bibliotheekroutes blijven behouden: wis geen sitegegevens.

Bijwerken importeert geen nieuwe brondata. De bestaande netwerksnapshot van 21 november 2026 blijft meegeleverd (5.002 genummerde knooppunten en 7.575 bruikbare trajecten).

## Validatie

63 geautomatiseerde tests, TypeScript-controle, productiebuild en ZIP-verificatie. Aanvullend wordt de lokale Flock-host gecontroleerd op HTTPS, actuele HTML, script-MIME-types en afgeschermde projectbronnen.

## Bekende beperkingen

Praktijktests op Android en iPhone blijven nodig. GPS werkt op de voorgrond; gesproken instructies en achtergrondnavigatie ontbreken. Kaarttegels, plaatszoekopdrachten en nieuwe aanrijroutes vereisen internet. Niet alle officiële brontrajecten zijn routeerbaar. Zie README en de gebruikershandleiding voor details.
