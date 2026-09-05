import { KnooppuntNode } from '../types';

export const POPULAR_REGIONS = [
  { id: 'limburg_be', name: 'Belgisch Limburg (Zutendaal & Kempen)', center: [50.9315, 5.5728] as [number, number], zoom: 12 },
  { id: 'limburg_nl', name: 'Nederlands Zuid-Limburg (Heuvelland & Maastricht)', center: [50.8514, 5.6909] as [number, number], zoom: 12 },
  { id: 'antwerpen', name: 'Antwerpse Kempen & Kalmthoutse Heide', center: [51.3850, 4.4750] as [number, number], zoom: 12 },
  { id: 'veluwe', name: 'Veluwe & Utrechtse Heuvelrug', center: [52.1326, 5.9288] as [number, number], zoom: 11 },
  { id: 'zeeland', name: 'Zeeland & Scheldedelta', center: [51.5000, 3.8000] as [number, number], zoom: 11 },
  { id: 'vlaamse_ardennen', name: 'Vlaamse Ardennen & Gent', center: [50.8500, 3.6500] as [number, number], zoom: 11 },
];

/**
 * Curated list of prominent cycling nodes (knooppunten) with authentic coordinates and real network tags.
 * Centered around Zutendaal, Hoge Kempen, Bokrijk, Maasmechelen, Hasselt, Maastricht, etc.
 */
export const INITIAL_NODES: KnooppuntNode[] = [
  // Zutendaal & Nationaal Park Hoge Kempen area
  {
    id: 'kp-64',
    ref: '64',
    lat: 50.9315,
    lng: 5.5728,
    name: 'Zutendaal Dorp',
    municipality: 'Zutendaal',
    region: 'Belgisch Limburg',
    highlight: 'Groenste snoepje van Vlaanderen & toegang tot Hoge Kempen',
    connections: ['63', '65', '550', '29', '30']
  },
  {
    id: 'kp-65',
    ref: '65',
    lat: 50.9452,
    lng: 5.5980,
    name: 'Papendaal & Hesselsberg',
    municipality: 'Zutendaal',
    region: 'Belgisch Limburg',
    connections: ['64', '66', '550']
  },
  {
    id: 'kp-66',
    ref: '66',
    lat: 50.9634,
    lng: 5.6275,
    name: 'Kattevennen & Kosmodroom',
    municipality: 'Genk / Zutendaal',
    region: 'Belgisch Limburg',
    highlight: 'Toegangspoort Kattevennen Nationaal Park',
    connections: ['65', '67', '30', '550']
  },
  {
    id: 'kp-550',
    ref: '550',
    lat: 50.9782,
    lng: 5.6601,
    name: 'Fietsen door de Heide (Hoge Kempen)',
    municipality: 'Maasmechelen / Zutendaal',
    region: 'Belgisch Limburg',
    highlight: '★ Iconische houten fietsbrug door de Mechelse Heide',
    connections: ['64', '65', '66', '60', '551']
  },
  {
    id: 'kp-551',
    ref: '551',
    lat: 50.9880,
    lng: 5.6980,
    name: 'Station As & Mijnkathedraal',
    municipality: 'As',
    region: 'Belgisch Limburg',
    highlight: 'Historisch Kolenspoor & uitkijktoren',
    connections: ['550', '41', '565']
  },
  {
    id: 'kp-63',
    ref: '63',
    lat: 50.9150,
    lng: 5.5410,
    name: 'Stalkerbos & Munsterbilzen grens',
    municipality: 'Zutendaal / Bilzen',
    region: 'Belgisch Limburg',
    connections: ['64', '68', '131']
  },
  {
    id: 'kp-30',
    ref: '30',
    lat: 50.9410,
    lng: 5.5180,
    name: 'Genk Sledderlo & Schansbroek',
    municipality: 'Genk',
    region: 'Belgisch Limburg',
    connections: ['64', '66', '31']
  },
  {
    id: 'kp-31',
    ref: '31',
    lat: 50.9620,
    lng: 5.5010,
    name: 'Thor Park & C-Mine',
    municipality: 'Genk',
    region: 'Belgisch Limburg',
    highlight: 'Historische mijnsite en terrilpaden',
    connections: ['30', '41', '91']
  },
  {
    id: 'kp-91',
    ref: '91',
    lat: 50.9592,
    lng: 5.3925,
    name: 'Fietsen door het Water (Bokrijk)',
    municipality: 'Genk / Hasselt',
    region: 'Belgisch Limburg',
    highlight: '★ Wereldberoemd: fiets dwars door de vijver op ooghoogte',
    connections: ['71', '92', '95', '31', '97']
  },
  {
    id: 'kp-95',
    ref: '95',
    lat: 50.9380,
    lng: 5.3450,
    name: 'Japanse Tuin & Kapermolen',
    municipality: 'Hasselt',
    region: 'Belgisch Limburg',
    highlight: 'Grootste Japanse Tuin van Europa',
    connections: ['91', '96', '98']
  },
  {
    id: 'kp-272',
    ref: '272',
    lat: 51.1685,
    lng: 5.3092,
    name: 'Fietsen door de Bomen (Bosland)',
    municipality: 'Hechtel-Eksel',
    region: 'Belgisch Limburg',
    highlight: '★ Spectaculaire dubbele cirkelvormige brug tot 10m hoog',
    connections: ['255', '256', '269']
  },
  {
    id: 'kp-60',
    ref: '60',
    lat: 50.9920,
    lng: 5.6720,
    name: 'Connecterra / Terhills Maasmechelen',
    municipality: 'Maasmechelen',
    region: 'Belgisch Limburg',
    highlight: 'Terrilpanorama over de Maasvallei',
    connections: ['550', '502', '565']
  },
  {
    id: 'kp-502',
    ref: '502',
    lat: 50.9650,
    lng: 5.7180,
    name: 'Kruisberg & RivierPark Maasvallei',
    municipality: 'Lanaken',
    region: 'Belgisch Limburg',
    connections: ['60', '503', '64']
  },
  {
    id: 'kp-503',
    ref: '503',
    lat: 50.8920,
    lng: 5.6620,
    name: 'Oud-Rekem (Mooiste Dorp van Vlaanderen)',
    municipality: 'Lanaken',
    region: 'Belgisch Limburg',
    highlight: 'Kasteel d Aspremont-Lynden & Maasvallei',
    connections: ['502', '10', '131']
  },

  // Cross-border: Maastricht & Nederlands Limburg
  {
    id: 'kp-nl-10',
    ref: '10',
    lat: 50.8514,
    lng: 5.6909,
    name: 'Maastricht Vrijthof & Markt',
    municipality: 'Maastricht',
    region: 'Nederlands Limburg',
    highlight: 'Historische binnenstad & Maasbruggen',
    connections: ['503', '01', '02', '03']
  },
  {
    id: 'kp-nl-01',
    ref: '01',
    lat: 50.8710,
    lng: 5.7120,
    name: 'Sint-Pietersberg & Maasdal',
    municipality: 'Maastricht',
    region: 'Nederlands Limburg',
    highlight: 'Kalksteengroeve & uitzicht over de Maas',
    connections: ['10', '02', '06']
  },
  {
    id: 'kp-nl-02',
    ref: '02',
    lat: 50.8650,
    lng: 5.7650,
    name: 'Bemelen & Mergelland route',
    municipality: 'Eijsden-Margraten',
    region: 'Nederlands Limburg',
    connections: ['10', '01', '59', '68']
  },
  {
    id: 'kp-nl-59',
    ref: '59',
    lat: 50.8640,
    lng: 5.8320,
    name: 'Valkenburg aan de Geul',
    municipality: 'Valkenburg',
    region: 'Nederlands Limburg',
    highlight: 'Kasteelruïne, Cauberg & Geuldal',
    connections: ['02', '60', '85']
  },
  {
    id: 'kp-nl-85',
    ref: '85',
    lat: 50.8150,
    lng: 5.8850,
    name: 'Gulpen & Gulpdal',
    municipality: 'Gulpen-Wittem',
    region: 'Nederlands Limburg',
    highlight: 'Gulpener Brouwerij & glooiende heuvels',
    connections: ['59', '90', '92']
  },
  {
    id: 'kp-nl-90',
    ref: '90',
    lat: 50.7545,
    lng: 6.0208,
    name: 'Drielandenpunt Vaals (322m)',
    municipality: 'Vaals',
    region: 'Nederlands Limburg',
    highlight: '★ Hoogste punt van Nederland & grens NL-BE-DE',
    connections: ['85', '91']
  },

  // Borgloon & Haspengouw (Bloesemstreek)
  {
    id: 'kp-131',
    ref: '131',
    lat: 50.8740,
    lng: 5.5180,
    name: 'Alden Biesen (Landcommanderij)',
    municipality: 'Bilzen',
    region: 'Belgisch Limburg',
    highlight: 'Imposant waterslot & Engelse kasteeltuinen',
    connections: ['63', '503', '136', '137']
  },
  {
    id: 'kp-136',
    ref: '136',
    lat: 50.8030,
    lng: 5.3520,
    name: 'Doorkijkkerkje Reading between the Lines',
    municipality: 'Borgloon',
    region: 'Belgisch Limburg',
    highlight: '★ Beroemd transparant kunstkerkje van Gijs Van Vaerenbergh',
    connections: ['131', '137', '152']
  },

  // Brabant & Kempen border
  {
    id: 'kp-nb-25',
    ref: '25',
    lat: 51.4420,
    lng: 5.4790,
    name: 'Van Gogh Fietsroute Eindhoven',
    municipality: 'Eindhoven',
    region: 'Noord-Brabant (NL)',
    highlight: 'Lichtgevend fietspad geïnspireerd door Sterrennacht',
    connections: ['26', '27', '38']
  },
  {
    id: 'kp-be-01',
    ref: '01',
    lat: 51.3240,
    lng: 4.9450,
    name: 'Turnhout Begijnhof & Kasteel',
    municipality: 'Turnhout',
    region: 'Antwerpen',
    connections: ['02', '03', '04']
  },
  {
    id: 'kp-be-02',
    ref: '02',
    lat: 51.3850,
    lng: 4.4750,
    name: 'Kalmthoutse Heide De Vroente',
    municipality: 'Kalmthout',
    region: 'Antwerpen',
    highlight: 'Grensoverschrijdend natuurpark heide & vennen',
    connections: ['01', '05', '06']
  }
];
