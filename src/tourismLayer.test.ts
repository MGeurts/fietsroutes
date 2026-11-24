// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { tourismPopup } from './components/tourismLayer';

it('toont OSM-tekst veilig en maakt alleen veilige websites aanklikbaar', () => {
  const popup = tourismPopup({ id: 'node/123', category: 'food', name: '<img src=x onerror=alert(1)>', kind: 'Restaurant', position: [3, 51], website: 'javascript:alert(1)', openingHours: '<script>evil</script>' });
  expect(popup.querySelector('img,script')).toBeNull();
  expect(popup.textContent).toContain('<img');
  expect(popup.querySelectorAll('a')).toHaveLength(0);
});
it('toont adres en telefoon indien beschikbaar, maar nooit openingsuren', () => {
  const popup = tourismPopup({ id: 'node/1', category: 'food', name: 'Restaurant', kind: 'Restaurant', position: [3, 51], address: 'Bosstraat 12, 9000 Gent', phone: '+32 9 123 45 67', openingHours: 'Mo-Su 10:00-22:00' });
  expect(popup.textContent).toContain('Bosstraat 12, 9000 Gent');
  expect(popup.textContent).toContain('Tel.: +32 9 123 45 67');
  expect(popup.textContent).not.toContain('10:00');
  expect(popup.textContent).not.toContain('Openingsuren');
});
