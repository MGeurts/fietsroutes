export function roundTripName(startNumber: string | null, meters: number, direction?: string): string {
  const length = (meters / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 });
  return `${startNumber ? `${startNumber} - ` : ''}Rondrit${direction ? ` ${direction}` : ''} ${length} km`;
}
export function gpxFilename(name: string): string {
  // Preserve decimal commas. Remove only characters forbidden in Windows filenames.
  const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/[. ]+$/g, '');
  return `${safe || 'fietsroute'}.gpx`;
}
export function copyRouteName(name: string, existingNames: string[]): string {
  const base = (name.trim() || 'Mijn fietsroute').replace(/(?:\s+\(kopie(?:\s+\d+)?\))+$/i, '');
  const normalize = (value: string) => value.trim().toLocaleLowerCase('nl-BE');
  const taken = new Set(existingNames.map(normalize));
  let number = 1;
  for (const existing of existingNames) {
    const match = existing.trim().match(/^(.*?)\s+\(kopie\s+(\d+)\)$/i);
    if (match && normalize(match[1]) === normalize(base)) {
      const parsed = Number(match[2]);
      if (Number.isSafeInteger(parsed) && parsed < 1000000) number = Math.max(number, parsed + 1);
    }
  }
  let candidate: string;
  do {
    const suffix = ` (kopie ${number++})`;
    candidate = `${base.slice(0, 120 - suffix.length).trimEnd()}${suffix}`;
  } while (taken.has(normalize(candidate)));
  return candidate;
}

export function suggestedRouteName(startNumber: string, endNumber: string, meters: number, closed: boolean): string {
  const length = (meters / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 });
  return [startNumber, closed ? 'Rondrit' : 'Naar ' + endNumber, length + ' km'].join(' - ');
}
