import L from '../leafletRuntime';
import { SpatialGrid, pointBox } from '../domain/spatialIndex';
import { safeWebsite, tourismCategories, type TourismPlace, type TourismSnapshot } from '../domain/tourism';

export function tourismPopup(place: TourismPlace, onPause?: (place: TourismPlace) => void): HTMLElement {
  const root = document.createElement('div'); root.className = 'tourism-popup';
  const title = document.createElement('strong'); title.textContent = place.name; root.append(title);
  for (const text of [place.kind, place.address, place.openingHours ? `Openingsuren: ${place.openingHours}` : '']) {
    if (text) { const line = document.createElement('p'); line.textContent = text; root.append(line); }
  }
  const website = safeWebsite(place.website);
  if (website) { const link = document.createElement('a'); link.href = website; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Website'; root.append(link); }
  if (onPause) { const button = document.createElement('button'); button.textContent = 'Als pauzeplaats toevoegen'; button.onclick = () => onPause(place); root.append(button); }
  return root;
}

export function addTourismLayer(map: L.Map, snapshot: TourismSnapshot, report: (text: string) => void, onPause?: (place: TourismPlace) => void): () => void {
  const grid = new SpatialGrid(snapshot.places.map(place => ({ value: place, box: pointBox(...place.position) })));
  const visible = new Map<string, L.Marker>();
  const date = new Date(snapshot.fetchedAt).toLocaleDateString('nl-BE');
  function draw() {
    const bounds = map.getBounds(), zoom = map.getZoom();
    const all = zoom >= 14 ? grid.query({ west: bounds.getWest(), east: bounds.getEast(), south: bounds.getSouth(), north: bounds.getNorth() }) : [];
    // Keep dense city centres readable and bound DOM work, independently of dataset size.
    const cells = new Set<string>();
    const places = all.filter(place => { const p = map.project([place.position[1], place.position[0]], zoom), cell = `${Math.floor(p.x / 34)}:${Math.floor(p.y / 34)}`; if (cells.has(cell)) return false; cells.add(cell); return true; }).slice(0, 250);
    const ids = new Set(places.map(p => p.id));
    for (const [id, marker] of visible) if (!ids.has(id)) { marker.remove(); visible.delete(id); }
    for (const place of places) if (!visible.has(place.id)) {
      const category = tourismCategories[place.category];
      const marker = L.marker([place.position[1], place.position[0]], { pane: 'tourism', title: `${place.name} · ${place.kind}`, keyboard: true, icon: L.divIcon({ className: 'tourism-icon', html: `<span class="tourism-pin tourism-${place.category}" aria-hidden="true">${category.symbol}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }) });
      marker.bindPopup(() => tourismPopup(place, onPause)).addTo(map); visible.set(place.id, marker);
    }
    report(zoom < 14 ? 'Toerisme: zoom in vanaf niveau 14 om plaatsen te zien.' : `${places.length} toeristische plaatsen${all.length > places.length ? ' · zoom in voor meer' : ''} · OSM ${date}`);
  }
  draw(); map.on('moveend', draw);
  return () => { map.off('moveend', draw); for (const marker of visible.values()) marker.remove(); };
}
