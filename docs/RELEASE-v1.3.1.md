# Fietsroutes Vlaanderen v1.3.1

24 november 2026. Onderhoudsrelease met betrouwbaardere gegevensimports en duidelijkere toeristische popups.

## Toeristische informatie

- Popups tonen geen openingsuren meer, wel het adres en telefoonnummer indien beschikbaar. Telefoonnummers worden uit zowel phone als contact:phone overgenomen; volledige OSM-adressen worden ondersteund.
- De keuzelijst voor pauzetijd heeft dezelfde afgeronde, brede opmaak als andere invoervelden. De uitleg eronder heeft meer witruimte.
- Toerismesnapshot vernieuwd: 33.871 plaatsen. Beschikbaarheid en volledigheid van gegevens hangen af van OpenStreetMap.

## Betrouwbaardere toerisme-import

- Acht kleinere gebieden, na elkaar opgehaald met een korte pauze tussen aanvragen.
- Tijdelijke HTTP- en netwerkfouten worden maximaal drie keer geprobeerd. Bij overbelasting worden Retry-After en langere wachttijden gerespecteerd.
- Aanvragen krijgen maximaal 128 MB werkgeheugen. Bij geheugen- of tijdslimieten wordt het gebied automatisch opgesplitst, maximaal drie niveaus diep. De concrete servermelding wordt getoond.
- Geslaagde gebieden en deelgebieden worden lokaal bewaard. Na een fout of Ctrl+C hervat `npm run data:tourism` **zonder `--fresh`** alleen de ontbrekende delen van een onvoltooide run, maximaal zes uur lang.
- `npm run data:tourism -- --fresh` begint bewust opnieuw. Gebruik deze optie niet bij iedere herpoging als je geslaagde gebieden wilt hergebruiken.
- Een procesvergrendeling voorkomt gelijktijdige imports. Een vergrendeling van een beëindigd proces wordt bij de volgende start hersteld.
- De snapshot wordt pas na een volledige, gevalideerde import atomair vervangen. Lege resultaten of een onverwachte daling van meer dan 30% vervangen de bestaande snapshot niet.

## Windows en netwerkgegevens

- Atomair vervangen krijgt veilige herpogingen bij EPERM, EACCES en EBUSY. De bestaande gegevens worden niet vooraf verwijderd.
- Netwerkimport gebruikt unieke tijdelijke bestanden in de lokale cache, buiten de publicatiemap.
- Na een geslaagde WFS-download kun je met `npm run data:refresh -- --cached` opnieuw verwerken zonder nogmaals te downloaden. Voer daarna tests en build uit.
- Netwerksnapshot vernieuwd; 5.002 genummerde knooppunten, 7.655 trajecten en 80 éénrichtingstrajecten.
- Importtests zijn opgenomen in `npm test`, inclusief hervatten, opsplitsen, wachttijden en bestandsvergrendelingen. Afhankelijkheden en lockbestand bijgewerkt.

## Installeren en bijwerken

Download `fietsroutes-antagonist.zip` en upload de volledige uitgepakte inhoud naar de documentroot van het HTTPS-domein. Neem beide gegevensbestanden, `.htaccess`, serviceworker en alle assets mee. Gebruik daarna Bijwerken in de app. Bewaarde routes blijven behouden. De GitHub-release uploadt niet automatisch naar Antagonist.
