// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShareRoute } from './components/ShareRoute';
import { routeShareUrl } from './domain/sharing';
let root: Root, element: HTMLDivElement;
beforeEach(()=>{ Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true}); element=document.createElement('div'); root=createRoot(element); });
afterEach(async()=>{ await act(async()=>root.unmount()); vi.unstubAllGlobals(); });
it('toont QR en publieke link en kopieert hetzelfde adres zonder externe aanvraag',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined), fetch=vi.fn();
  vi.stubGlobal('navigator',{clipboard:{writeText}});vi.stubGlobal('fetch',fetch);
  await act(async()=>root.render(<ShareRoute stops={['1','2']} name="Mijn tocht"/>));
  expect(element.querySelector('svg[role="img"]')??element.querySelector('.route-qr svg')).not.toBeNull();
  expect((element.querySelector('#share-url') as HTMLInputElement).value).toBe(routeShareUrl(['1','2'], 'Mijn tocht'));
  await act(async()=>[...element.querySelectorAll('button')].find(b=>b.textContent==='Link kopiëren')!.click());
  expect(writeText).toHaveBeenCalledWith(routeShareUrl(['1','2'], 'Mijn tocht'));expect(element.textContent).toContain('Link gekopieerd');expect(fetch).not.toHaveBeenCalled();
});
it('laat de link beschikbaar bij geweigerde klembordtoegang',async()=>{
  vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(Error('geweigerd'))}});
  await act(async()=>root.render(<ShareRoute stops={['1','2']} name="Mijn tocht"/>));
  await act(async()=>[...element.querySelectorAll('button')].find(b=>b.textContent==='Link kopiëren')!.click());
  expect(element.textContent).toContain('Selecteer en kopieer');expect(element.querySelector('#share-url')).not.toBeNull();
});
