# Updates automatiseren

## Wat nu automatisch gebeurt

De lokale ontwikkelomgeving is **[Flock](https://flockphp.com/)**. Voer de onderstaande opdrachten uit in de projectmap op je ontwikkelcomputer. De nieuwe build wordt daarna door Flock aangeboden op `https://fietsroutes.test`; de Antagonist-ZIP wordt lokaal bijgewerkt. Op de productiehosting zijn Flock en Node.js niet nodig.

```powershell
# Bouw met de bestaande lokale dataset en vernieuw de Antagonist-ZIP
npm run build

# Haal de brondata op, test, bouw en vernieuw de Antagonist-ZIP
npm run data:update

# Werk pakketafhankelijkheden bij; test en bouw daarna opnieuw
npm update
npm test
npm run build
```

Elke geslaagde build start via npm automatisch `postbuild`. Die maakt één archief:

- `releases/fietsroutes-antagonist.zip`, als vaste bestandsnaam voor de laatste geslaagde verpakking.

De ZIP bevat de inhoud van `dist/`, inclusief `.htaccess`. Het script controleert vereiste bestanden en leest het volledige archief terug vóór het een bestaand ZIP-bestand vervangt. De verpakking wijzigt de appversie niet. Een mislukte import of test stopt `data:update` vóór de build; een mislukte build start geen nieuwe verpakking. Het archief wordt niet automatisch geüpload.

`npm run data:refresh` blijft beschikbaar voor het afzonderlijk ophalen van de dataset. Alleen die opdracht vernieuwt dus geen build of ZIP.

## Periodiek verversen

Er is momenteel **geen periodiek schema en geen automatische upload** ingesteld. De browserapp gebruikt de gepubliceerde snapshot en haalt niet zelf de officiële WFS-data op. Een browser-timer werkt bovendien alleen wanneer de app actief is en zou de import en kwaliteitscontroles naar iedere bezoeker verplaatsen.

### GitHub Actions met geplande publicatie

De aanbevolen vervolgstap is een wekelijkse workflow die de brondata ophaalt, valideert, test, bouwt en de ZIP beschikbaar stelt. Voor volledig automatische online actualisering moet daarna ook een beveiligde upload van de build naar Antagonist worden ingericht. Node.js draait dan alleen op de GitHub-runner; Antagonist blijft een statische website zonder Node-runtime.

Een geplande workflow vereist dat de configuratie op de standaardbranch staat en de workflow actief is. GitHub beschrijft dit bij [geplande workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Uploadtoegang moet afzonderlijk als secret worden ingesteld, zonder wachtwoorden in de repository.

Een GitHub-taak kan de online versie actualiseren terwijl de ontwikkelcomputer uitstaat. De lokale checkout verandert daardoor niet vanzelf: haal de bijgewerkte snapshot uit Git op als die wordt gecommit, of gebruik lokaal `npm run data:update`.

### Antagonist-cronjob met PHP

Antagonist beschrijft [cronjobs voor PHP-scripts](https://help.antagonist.nl/hc/nl/articles/8523896468497-Hoe-stel-ik-cronjobs-in). Daarmee is een servergestuurde dataverversing zonder Node.js technisch mogelijk, voor zover de beschikbare pakketfuncties en limieten dit toelaten.

Dat vereist nog een PHP-importer met dezelfde normalisatie en kwaliteitscontroles, bescherming tegen overlappende runs, veilige vervanging van de dataset en aangepaste browsercachelogica. Alleen ruwe WFS-data downloaden of `network.json` overschrijven is niet voldoende: de app verwacht de genormaliseerde graaf, en de huidige serviceworker bewaart de snapshot als onderdeel van de build. Deze PHP-opzet is niet geïmplementeerd.

### Lokale taakplanner

Een lokale geplande taak kan `npm run data:update` uitvoeren vanuit de projectmap. Die werkt alleen wanneer de computer aanstaat en de taak toegang tot Node.js en internet heeft. Ook dan blijft uploaden een afzonderlijke stap. Er is in deze repository geen Windows-taak of andere lokale planning aangemaakt.



## Nieuwe appversies in de browser

Bij openen of verversen haalt de app de startpagina rechtstreeks van de server op, zonder HTTP-cache. Zonder verbinding gebruikt hij de vooraf bewaarde app. Het versienummer staat links van de infoknop en in de informatiemodal. Een reeds geopende app controleert ook bij terugkeer naar het venster, na herstel van de verbinding en ieder uur op updates. Via **Bijwerken** wordt eerst de werkroute bewaard; tijdens navigatie blijft die knop uitgeschakeld.

Bij de overstap vanaf een oudere versie kan de oude serviceworker nog actief zijn. Voer dan eenmaal Ctrl+Shift+R uit en kies **Bijwerken** als die melding verschijnt. Bewaarde routes hoeven niet verwijderd te worden. Upload bij Antagonist steeds de volledige inhoud van de nieuwste ZIP.

De knop Bijwerken activeert expliciet de wachtende serviceworker en herstart zodra deze de pagina overneemt. De melding toont deze stap; bij een fout of na 15 seconden zonder overname worden de knoppen opnieuw beschikbaar. De bewaarde werkroute blijft behouden.

De appupdateknop vernieuwt geen officiële brondata: een nieuwe snapshot komt uitsluitend mee met een gepubliceerde build. De knop Bijwerken bij een geopende bibliotheekroute heeft een andere functie: daarmee bewaar je wijzigingen in die route.

Als een andere tab de update al activeerde, herlaadt Bijwerken de actieve appversie. De herstart wacht op activatie of controleovername, zodat een ontbrekend controllerchange-event de knop niet laat vastlopen. Bij fouten toont de melding de concrete oorzaak.
