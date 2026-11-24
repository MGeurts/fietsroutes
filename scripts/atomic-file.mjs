import { rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

// Retrying rename preserves atomic replacement. Never remove the destination first.
export async function replaceFile(temporary, target, { move = rename, wait = delay, report = console.warn } = {}) {
  const delays = [200, 400, 800, 1600, 2000, 2000];
  for (let attempt = 0; ; attempt++) {
    try { await move(temporary, target); return; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
      if (attempt >= delays.length) throw new Error(`Kan ${target} niet vervangen (${error.code}). Het bestand is mogelijk in gebruik of de schrijfrechten ontbreken. Het bestaande bestand is niet verwijderd; de nieuwe gegevens staan in ${temporary}. Sluit programma's die het bestand vasthouden en probeer opnieuw.`, { cause: error });
      if (!attempt) report(`Bestand tijdelijk niet vervangbaar (${error.code}): ${target}. Opnieuw proberen…`);
      await wait(delays[attempt]);
    }
  }
}
