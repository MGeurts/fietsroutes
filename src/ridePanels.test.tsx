// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { RidePanels } from './components/RidePanels';
import type { RouteViewpoint } from './domain/routeViewpoints';
import { createNetwork, locateOnRoute, planRoute, type Dataset } from './domain/network';
const data:Dataset={version:1,fetchedAt:'',attribution:'',report:{skippedEdges:0,ambiguousIds:0,invalidGeometry:0},junctions:['1','2','3'].map((id,i)=>({id,number:id,position:[3+i*.005,51],network:'',owner:''})),edges:[{id:'a',from:'1',to:'2',coordinates:[[3,51],[3.005,51]]},{id:'b',from:'2',to:'3',coordinates:[[3.005,51],[3.01,51]]}]};
const network=createNetwork(data),progress={meters:100,remaining:20000,offRoute:0,next:'2',nextAfter:'3',nextDistance:420,arrived:false};
const props={network,progress,totalMeters:20100,currentSpeed:20.1,profileSpeed:20,accuracy:5,gpsStale:false,now:new Date(2026,10,23,13,0).getTime(),onStop:vi.fn()};
it('toont icoon en naam onderaan de bovenste badge zolang toeristische punten actief zijn', () => {
  const root = document.createElement('div');
  const point = { place: { id: 'node/1', category: 'sight', name: 'Tankmonument' }, metersFromStart: 200, metersFromRoute: 0 } as RouteViewpoint;
  root.innerHTML = renderToStaticMarkup(<RidePanels {...props} nearbyTourism={[point]}/>);
  expect(root.querySelector('.ride-card .ride-tourism')?.textContent).toContain('Tankmonument');
  expect(root.querySelector('.ride-tourism .tourism-pin')?.textContent).toBe('🏛');
  expect(root.querySelector('.ride-tourism-distance')?.textContent).toBe('Over 100 m');
  root.innerHTML = renderToStaticMarkup(<RidePanels {...props} progress={{ ...progress, meters: 250 }} nearbyTourism={[point]}/>);
  expect(root.querySelector('.ride-tourism-distance')?.textContent).toBe('Net voorbij');
  root.innerHTML = renderToStaticMarkup(<RidePanels {...props} nearbyTourism={[]}/>);
  expect(root.querySelector('.ride-tourism')).toBeNull();
});
it('toont boven de volgende twee knooppunten met afstand en onder snelheid-afstand-ETA zonder tekstlabels',()=>{
  const root=document.createElement('div');root.innerHTML=renderToStaticMarkup(<RidePanels {...props}/>);
  expect(root.querySelector('.ride-next-node')?.textContent).toBe('2');expect(root.querySelector('.ride-next-distance')?.textContent).toBe('420 m');expect(root.querySelector('.ride-after b')?.textContent).toBe('3');
  const metrics=[...root.querySelectorAll('.ride-metric')];
  expect(metrics.map(e=>e.getAttribute('aria-label'))).toEqual(['Actuele snelheid','Resterende afstand','Geschatte aankomsttijd']);
  expect(metrics.map(e=>e.textContent)).toEqual(['20,1 km/u','20 km','14:00']);
  expect(root.querySelector('.ride-stop')?.textContent).toBe('');expect(root.querySelector('.ride-stop')?.getAttribute('aria-label')).toBe('Navigatie stoppen');
});
it('toont geen schijnsnelheid of ETA bij ontbrekende GPS en geen ETA bij afwijking',()=>{
  const root=document.createElement('div');root.innerHTML=renderToStaticMarkup(<RidePanels {...props} gpsStale={true}/>);
  expect(root.querySelector('[aria-label="Actuele snelheid"]')?.textContent).toBe('— km/u');expect(root.querySelector('[aria-label="Geschatte aankomsttijd"]')?.textContent).toBe('—');
  root.innerHTML=renderToStaticMarkup(<RidePanels {...props} progress={{...progress,offRoute:100}}/>);expect(root.querySelector('[aria-label="Geschatte aankomsttijd"]')?.textContent).toBe('—');
});
it('houdt het daaropvolgende knooppunt correct bij herhaalde bezoeken aan dezelfde ID',()=>{
  const route=planRoute(network,['1','3','1']);
  const first=locateOnRoute(route,[3,51],0,network);expect(first.next).toBe('2');expect(first.nextAfter).toBe('3');
  const later=locateOnRoute(route,[3.01,51],route.meters/2,network);expect(later.next).toBe('2');expect(later.nextAfter).toBe('1');
});
