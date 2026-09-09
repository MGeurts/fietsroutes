export interface PopularRegionInfo {
  id: string;
  name: string;
  country: 'BE' | 'NL' | 'BE/NL';
  description: string;
  center: [number, number];
  zoom: number;
  bbox: [number, number, number, number];
}

// Viewport presets only. Network nodes and connections are loaded exclusively
// from the generated build dataset in public/data/benelux_network.json.
export const POPULAR_REGIONS: PopularRegionInfo[] = [
  {
    id: 'limburg_be',
    name: 'Belgisch Limburg (Zutendaal, Kempen, Maasland)',
    country: 'BE',
    description: 'De geboortegrond van het knooppuntennetwerk. Hoge Kempen, Bokrijk en Maasmechelen.',
    center: [50.9337, 5.5757],
    zoom: 12,
    bbox: [50.85, 5.35, 51.10, 5.75],
  },
  {
    id: 'limburg_nl',
    name: 'Nederlands Zuid-Limburg (Maastricht & Heuvelland)',
    country: 'NL',
    description: 'Glooiend heuvellandschap, Mergelland, Valkenburg en historische Maasvallei.',
    center: [50.8514, 5.6909],
    zoom: 12,
    bbox: [50.75, 5.60, 50.98, 6.00],
  },
  {
    id: 'antwerpen',
    name: 'Antwerpse Kempen & Kalmthoutse Heide',
    country: 'BE',
    description: 'Vennen, uitgestrekte dennenbossen en grensoverschrijdende heidepaden.',
    center: [51.3850, 4.4750],
    zoom: 12,
    bbox: [51.25, 4.30, 51.48, 4.70],
  },
  {
    id: 'vlaamse_ardennen',
    name: 'Vlaamse Ardennen & Gent',
    country: 'BE',
    description: 'Kasseistroken, hellingen, Leiestreek en historische stadsranden van Gent.',
    center: [50.8500, 3.6500],
    zoom: 11,
    bbox: [50.75, 3.50, 51.05, 3.90],
  },
  {
    id: 'zeeland',
    name: 'Zeeland & Scheldedelta',
    country: 'NL',
    description: 'Dijkroutes langs het water, duinen, Oosterschelde en Noordzeestranden.',
    center: [51.5000, 3.8000],
    zoom: 11,
    bbox: [51.35, 3.50, 51.68, 4.10],
  },
  {
    id: 'brabant_nl',
    name: 'Noord-Brabant & De Kempen',
    country: 'NL',
    description: 'Brabantse bossen, heidegebieden, Eindhoven en Vincent van Gogh erfgoed.',
    center: [51.4500, 5.4000],
    zoom: 11,
    bbox: [51.30, 5.15, 51.60, 5.65],
  },
  {
    id: 'veluwe',
    name: 'Veluwe & Utrechtse Heuvelrug',
    country: 'NL',
    description: 'Grootste aaneengesloten natuurgebied van Nederland met zandverstuivingen en bos.',
    center: [52.1326, 5.9288],
    zoom: 11,
    bbox: [52.00, 5.70, 52.35, 6.15],
  },
  {
    id: 'vlaams_brabant',
    name: 'Vlaams-Brabant (Hageland & Dijleland)',
    country: 'BE',
    description: 'Kastelen, wijngaarden, fruitboomgaarden en de heuvels rond Leuven.',
    center: [50.8800, 4.7000],
    zoom: 11,
    bbox: [50.75, 4.50, 51.00, 5.00],
  },
];
