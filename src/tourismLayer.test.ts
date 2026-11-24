// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { tourismPopup } from './components/tourismLayer';

it('toont OSM-tekst veilig en maakt alleen veilige websites aanklikbaar', () => {
  const popup = tourismPopup({ id: 'node/123', category: 'food', name: '<img src=x onerror=alert(1)>', kind: 'Restaurant', position: [3, 51], website: 'javascript:alert(1)', openingHours: '<script>evil</script>' });
  expect(popup.querySelector('img,script')).toBeNull();
  expect(popup.textContent).toContain('<img');
  expect(popup.querySelectorAll('a')).toHaveLength(0);
});
