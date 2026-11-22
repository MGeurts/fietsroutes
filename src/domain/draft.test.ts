// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { draftKey, readDraft, readRecovery, writeDraft, type RouteDraft } from './draft';
const draft: RouteDraft = { version: 1, name: 'Werkrit', stops: ['1', '2'], speed: 20, tileLayer: 'network', activeId: 'saved-route' };
beforeEach(() => localStorage.clear());
it('herstelt puntkeuze, naam, fietsprofiel, kaartlaag en bibliotheekidentiteit', () => { writeDraft(draft); expect(readDraft()).toEqual(draft); });
it('bewaart ook een enkel startpunt en verwijdert een bewust leeggemaakte werkroute', () => {
  writeDraft({ ...draft, stops: ['1'] }); expect(readDraft()?.stops).toEqual(['1']);
  writeDraft({ ...draft, stops: [] }); expect(readDraft()).toBeNull();
});
it('weigert corrupt herstel zonder de opgeslagen bron te wissen', () => {
  localStorage.setItem(draftKey, '{kapot'); expect(readRecovery().error).toBeTruthy(); expect(localStorage.getItem(draftKey)).toBe('{kapot');
});
it('weigert ongeldig herstel en beperkt lijsten en profielen', () => {
  expect(() => writeDraft({ ...draft, stops: ['<script>'] })).toThrow();
  expect(() => writeDraft({ ...draft, stops: Array(201).fill('1') })).toThrow();
  expect(() => writeDraft({ ...draft, speed: 0 })).toThrow();
});
