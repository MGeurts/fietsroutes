// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { readDraft, writeDraft, type RouteDraft } from './domain/draft';
import { readLibrary, writeLibrary } from './domain/storage';
import * as approachRouting from './domain/approach';
const captured = vi.hoisted(() => ({ map: null as any }));
vi.mock('./components/MapView', () => ({ MapView: (props: any) => { captured.map = props; return null; } }));
vi.mock('./components/UpdateNotice', () => ({ UpdateNotice: () => null }));
vi.mock('./components/RoundTripChooser', () => ({ RoundTripChooser: (props: any) => <button onClick={() => props.onChoose({ stops: ['1', '2', '1'], meters: 2200 }, 'Noord')}>Kies Noord</button> }));
vi.mock('./useDeviceLocation', () => ({ useDeviceLocation: () => ({ location: null, accuracy: 0, lastFix: 0, status: '', locate: vi.fn() }) }));
vi.mock('./useApproach', () => ({ useApproach: () => ({ route: null, status: '', atStart: false }) }));
const data = { version: 1, fetchedAt: '2026-11-21T00:00:00Z', attribution: 'Test', report: { skippedEdges: 0, ambiguousIds: 0, invalidGeometry: 0 }, junctions: ['1', '2', '3'].map((id, i) => ({ id, number: id, position: [3 + i * 0.01, 51], network: 'Test', owner: 'Test' })), edges: [{ id: 'a', from: '1', to: '2', coordinates: [[3, 51], [3.01, 51]] }, { id: 'b', from: '2', to: '3', coordinates: [[3.01, 51], [3.02, 51]] }] };
const draft: RouteDraft = { version: 1, name: 'Bewaarde werkroute', stops: ['1', '2'], activeId: null, speed: 15, tileLayer: 'cycle', tourismEnabled: false };
let root: Root, element: HTMLDivElement;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); localStorage.clear(); window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  element = document.createElement('div'); document.body.appendChild(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
it('bekijkt en bevestigt een pauzeverbinding, bewaart die en heropent ze zonder netwerkverzoek', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  const routing = vi.spyOn(approachRouting, 'fetchApproach').mockImplementation(async (from, to) => ({ coordinates: [from, to], meters: 100 }));
  try {
    await act(async () => captured.map.onPause({ id: 'node/9', category: 'food', kind: 'Café', name: 'Boscafé', position: [3, 51.001] }));
    const button = (text: string) => [...element.querySelectorAll('button')].find(b => b.textContent === text)!;
    await act(async () => button('Verbinding bekijken').click());
    expect(routing).toHaveBeenCalledTimes(2);
    expect(captured.map.route.stops).toEqual(['1', '2']);
    await act(async () => button('Pauzeplaats toevoegen').click());
    expect(captured.map.route.stops).toHaveLength(3);
    expect(readDraft()?.pauses?.[0].place.name).toBe('Boscafé');
    await act(async () => (element.querySelector('.save-button') as HTMLButtonElement).click());
    expect(readLibrary()[0].pauses?.[0].minutes).toBe(20);
    await act(async () => root.unmount()); root = createRoot(element);
    await act(async () => root.render(<App/>));
    expect(captured.map.route.stops).toHaveLength(3);
    expect(routing).toHaveBeenCalledTimes(2);
  } finally { routing.mockRestore(); }
});

it('onthoudt categoriefilters en de keuze alleen langs de route', async () => {
  localStorage.setItem('fietsroutes:tourism-filter', JSON.stringify({categories:['food', 'sight', 'service'], alongRoute:false}));
  writeDraft(draft); await act(async () => root.render(<App/>));
  await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="Toerisme instellen"]')!.click());
  const labels = [...element.querySelectorAll('label')];
  await act(async () => (labels.find(l => l.textContent?.includes('Eten en drinken'))!.querySelector('input') as HTMLInputElement).click());
  await act(async () => (labels.find(l => l.textContent?.includes('Alleen langs mijn route'))!.querySelector('input') as HTMLInputElement).click());
  expect(captured.map.tourismCategories).not.toContain('food');
  expect(captured.map.tourismAlongRoute).toBe(true);
  await act(async () => root.unmount()); root = createRoot(element);
  await act(async () => root.render(<App/>));
  expect(captured.map.tourismCategories).not.toContain('food'); expect(captured.map.tourismAlongRoute).toBe(true);
});
it('schakelt toerisme onafhankelijk van de kaartlaag en herstelt de voorkeur', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  const button = element.querySelector<HTMLButtonElement>('[aria-label="Toerisme"]')!;
  expect(button.parentElement?.previousElementSibling?.getAttribute('aria-label')).toBe('Kaart centreren');
  expect(captured.map.tourismEnabled).toBe(false);
  await act(async () => button.click());
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(captured.map.tourismEnabled).toBe(true); expect(captured.map.tileLayer).toBe('cycle');
  expect(readDraft()?.tourismEnabled).toBe(true);
  await act(async () => root.unmount()); root = createRoot(element);
  await act(async () => root.render(<App/>));
  expect(captured.map.tourismEnabled).toBe(true);
  await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="Toerisme"]')!.click());
  expect(captured.map.tourismEnabled).toBe(false);
});
it('migreert de vroegere toeristische kaartlaag naar de losse schakelaar', async () => {
  writeDraft({ ...draft, tileLayer: 'tourism', tourismEnabled: undefined }); await act(async () => root.render(<App/>));
  expect(captured.map.tileLayer).toBe('network'); expect(captured.map.tourismEnabled).toBe(true);
});
it('kiest een rondrit zonder waarschuwing wanneer alleen een startpunt is gekozen', async () => {
  writeDraft({ ...draft, stops: ['1'] });
  await act(async () => root.render(<App/>));
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent?.includes('Maak er een rondrit van'))!.click());
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Kies Noord')!.click());
  expect(captured.map.route.stops).toEqual(['1', '2', '1']);
  expect(element.textContent).not.toContain('Niet bewaarde wijzigingen');
  expect((element.querySelector('#route-name') as HTMLInputElement).value).toBe('1 - Rondrit Noord 2,2 km');
});

it('beschermt een bewaarde route die tot een enkel startpunt werd ingekort', async () => {
  writeLibrary([{ id: 'saved', name: draft.name, stops: ['1', '2'], speed: 15, favorite: false, updatedAt: '' }]);
  writeDraft({ ...draft, activeId: 'saved', stops: ['1'] });
  await act(async () => root.render(<App/>));
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent?.includes('Maak er een rondrit van'))!.click());
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Kies Noord')!.click());
  expect(captured.map.route.stops).toEqual(['1']);
  expect(element.textContent).toContain('Niet bewaarde wijzigingen');
});
it('herstelt een werkroute inclusief profiel en kaartlaag en verliest niets bij een klik op het logo', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  expect((element.querySelector('#route-name') as HTMLInputElement).value).toBe(draft.name);
  expect((element.querySelector('#bike') as HTMLSelectElement).value).toBe('15'); expect(captured.map.tileLayer).toBe('cycle');
  expect(captured.map.route.stops).toEqual(['1', '2']);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  await act(async () => { element.querySelector('.brand')!.dispatchEvent(click); });
  expect(click.defaultPrevented).toBe(true); expect(captured.map.route.stops).toEqual(['1', '2']); expect(readDraft()).toEqual({ ...draft, tourismEnabled: false });
});
it('geeft een geldige deellink voorrang en herstelt na herladen de daarna bewerkte werkroute', async () => {
  writeDraft(draft); window.history.replaceState(null, '', '/#route=2,3&name=' + encodeURIComponent('534 - Café & bos - 25,3 km'));
  let complete!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }) as Promise<Response>);
  await act(async () => root.render(<App/>)); expect(readDraft()).toEqual(draft);
  await act(async () => complete({ ok: true, json: async () => data } as Response));
  expect(captured.map.route.stops).toEqual(['2', '3']); expect(window.location.hash).toBe('');
  expect((element.querySelector('#route-name') as HTMLInputElement).value).toBe('534 - Café & bos - 25,3 km');
  await act(async () => captured.map.onSelect('1')); expect(readDraft()?.stops).toEqual(['2', '3', '1']);
  await act(async () => root.unmount()); root = createRoot(element);
  await act(async () => root.render(<App/>)); expect(captured.map.route.stops).toEqual(['2', '3', '1']);
  expect((element.querySelector('#route-name') as HTMLInputElement).value).toBe('534 - Café & bos - 25,3 km');
});
it('verwijdert de herstelkopie wanneer bewust een nieuwe lege route wordt gestart', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  const button = [...element.querySelectorAll('button')].find(b => b.textContent === 'Nieuwe route')!;
  await act(async () => button.click());
  expect(captured.map.route.stops).toEqual(['1', '2']);
  expect(element.querySelector('dialog .unsaved-route-name')?.textContent).toBe(draft.name);
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Verwerpen')!.click());
  expect(readDraft()).toBeNull(); expect(captured.map.route.stops).toEqual([]);
});

it('bewaart het fietsprofiel voor het vervangen en markeert de geopende route', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Nieuwe route')!.click());
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Bewaren en doorgaan')!.click());
  expect(readLibrary()[0].speed).toBe(15); expect(captured.map.route.stops).toEqual([]);
  await act(async () => (element.querySelector('[aria-label="Mijn routes"]') as HTMLButtonElement).click());
  await act(async () => (element.querySelector('.library-open') as HTMLButtonElement).click());
  expect((element.querySelector('#bike') as HTMLSelectElement).value).toBe('15');
  expect(element.querySelector('.route-save-status')?.textContent).toBe('Bewaard op dit apparaat');
  expect((element.querySelector('.save-button') as HTMLButtonElement).disabled).toBe(true);
  await act(async () => (element.querySelector('[aria-label="Mijn routes"]') as HTMLButtonElement).click());
  expect(element.querySelector('.library-item.is-active')?.textContent).toContain('Geopend');
  expect(element.querySelector('.library-bike-profile')?.textContent).toBe('Stadsfiets');
  expect(element.querySelector('.library-bike-profile')?.getAttribute('title')).toContain('15 km/u');
});

it('annuleert vervangen en behoudt de route wanneer bewaren mislukt', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  const newRoute = () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Nieuwe route')!;
  await act(async () => newRoute().click());
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Annuleren')!.click());
  expect(captured.map.route.stops).toEqual(['1', '2']);
  await act(async () => newRoute().click());
  const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('Vol'); });
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Bewaren en doorgaan')!.click());
  failure.mockRestore();
  expect(captured.map.route.stops).toEqual(['1', '2']);
  expect(element.textContent).toContain('Opslaan lukt niet');
  expect(element.textContent).toContain('Bewaren en doorgaan');
});

it('opent oudere routes met een standaardprofiel en detecteert profielwijzigingen', async () => {
  writeLibrary([{ id: 'old', name: 'Oude route', stops: ['1', '2'], favorite: false, updatedAt: '' }]);
  await act(async () => root.render(<App/>));
  await act(async () => (element.querySelector('[aria-label="Mijn routes"]') as HTMLButtonElement).click());
  await act(async () => (element.querySelector('.library-open') as HTMLButtonElement).click());
  const bike = element.querySelector('#bike') as HTMLSelectElement;
  expect(bike.value).toBe('20');
  await act(async () => { bike.value = '25'; bike.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(element.querySelector('.route-save-status')?.textContent).toContain('Niet bewaard');
  expect(element.querySelector('.save-button')?.textContent).toBe('Wijzigingen bewaren');
  await act(async () => (element.querySelector('.save-button') as HTMLButtonElement).click());
  expect(readLibrary()[0].speed).toBe(25);
  expect(element.textContent).toContain('Route bewaard op dit apparaat.');
});


it('toont de actuele versie direct links van de infoknop', async () => {
  await act(async () => root.render(<App/>));
  const info = element.querySelector('[aria-label="Over de app"]')!;
  expect(info.previousElementSibling?.textContent).toBe('v' + __APP_VERSION__);
  expect(info.previousElementSibling?.classList.contains('header-version')).toBe(true);
});

it('behoudt de werkroute wanneer omkeren tegen eenrichting geen terugweg oplevert', async () => {
  writeDraft(draft);
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ...data, edges: [{ ...data.edges[0], oneWay: true }] }) } as Response);
  await act(async () => root.render(<App/>));
  await act(async () => (element.querySelector('[aria-label="Route omkeren"]') as HTMLButtonElement).click());
  expect(captured.map.route.stops).toEqual(['1','2']);
  expect((element.querySelector('#route-name') as HTMLInputElement).value).toBe(draft.name);
  expect(element.textContent).toContain('toegestane rijrichting');
});

it('start met rijrichting bovenaan en laat de navigatieknop schakelen naar noord', async()=>{
  const original=Object.getOwnPropertyDescriptor(navigator,'geolocation');
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{}});
  try {
    writeDraft(draft);await act(async()=>root.render(<App/>));
    const start=[...element.querySelectorAll('button')].find(b=>b.textContent==='Start met fietsen')!;
    await act(async()=>start.click());expect(captured.map.riding).toBe(true);expect(captured.map.headingUp).toBe(true);
    const toggle=element.querySelector('[aria-label="Rijrichting bovenaan"]') as HTMLButtonElement;
    expect(toggle.nextElementSibling?.getAttribute('aria-label')).toBe('Kaart centreren');
    expect(toggle.nextElementSibling?.nextElementSibling?.querySelector('[aria-label="Toerisme"]')).not.toBeNull();
    await act(async()=>toggle.click());expect(captured.map.headingUp).toBe(false);
    expect(element.querySelector('[aria-label="Noorden bovenaan"]')?.textContent).toBe('');
  } finally {if(original)Object.defineProperty(navigator,'geolocation',original);else Reflect.deleteProperty(navigator,'geolocation');}
});
