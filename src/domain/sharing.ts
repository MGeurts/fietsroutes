export const publicAppUrl = 'https://fietsroutes.kreaweb.be/';
export function routeShareUrl(stops: string[], name = ''): string {
  if (stops.length < 2 || stops.length > 200 || !stops.every(id => /^\d{1,16}$/.test(id))) throw Error('Kies eerst een geldige route met begin- en eindpunt.');
  const url = new URL(publicAppUrl);
  // Commas need not be escaped in the fragment; keeping them short improves QR readability.
  url.hash = 'route=' + stops.join(',') + (name.trim() ? '&name=' + encodeURIComponent(name.trim().slice(0, 120)) : '');
  return url.toString();
}
