export interface MunicipalityLocation {
  name: string;
  region: string;
  country: 'BE' | 'NL';
  lat: number;
  lng: number;
}

/**
 * Curated reference database of municipalities and towns across Flanders, Brussels,
 * Walloon borders, and Dutch cycling regions.
 */
export const MUNICIPALITIES_DATABASE: MunicipalityLocation[] = [
  // --- BELGISCH LIMBURG ---
  { name: 'Zutendaal', region: 'Belgisch Limburg', country: 'BE', lat: 50.9324, lng: 5.5724 },
  { name: 'Genk', region: 'Belgisch Limburg', country: 'BE', lat: 50.9655, lng: 5.5008 },
  { name: 'Hasselt', region: 'Belgisch Limburg', country: 'BE', lat: 50.9307, lng: 5.3378 },
  { name: 'Maasmechelen', region: 'Belgisch Limburg', country: 'BE', lat: 50.9634, lng: 5.6967 },
  { name: 'Bilzen', region: 'Belgisch Limburg', country: 'BE', lat: 50.8708, lng: 5.5175 },
  { name: 'Lanaken', region: 'Belgisch Limburg', country: 'BE', lat: 50.8911, lng: 5.6515 },
  { name: 'Dilsen-Stokkem', region: 'Belgisch Limburg', country: 'BE', lat: 51.0343, lng: 5.7262 },
  { name: 'Maaseik', region: 'Belgisch Limburg', country: 'BE', lat: 51.0954, lng: 5.7924 },
  { name: 'Bree', region: 'Belgisch Limburg', country: 'BE', lat: 51.1412, lng: 5.5976 },
  { name: 'Bocholt', region: 'Belgisch Limburg', country: 'BE', lat: 51.1719, lng: 5.5794 },
  { name: 'Pelt', region: 'Belgisch Limburg', country: 'BE', lat: 51.2132, lng: 5.4262 },
  { name: 'Lommel', region: 'Belgisch Limburg', country: 'BE', lat: 51.2307, lng: 5.3134 },
  { name: 'Hamont-Achel', region: 'Belgisch Limburg', country: 'BE', lat: 51.2505, lng: 5.5467 },
  { name: 'Peer', region: 'Belgisch Limburg', country: 'BE', lat: 51.1326, lng: 5.4542 },
  { name: 'Hechtel-Eksel', region: 'Belgisch Limburg', country: 'BE', lat: 51.1492, lng: 5.3746 },
  { name: 'Houthalen-Helchteren', region: 'Belgisch Limburg', country: 'BE', lat: 51.0287, lng: 5.3721 },
  { name: 'Beringen', region: 'Belgisch Limburg', country: 'BE', lat: 51.0494, lng: 5.2263 },
  { name: 'Heusden-Zolder', region: 'Belgisch Limburg', country: 'BE', lat: 51.0232, lng: 5.2796 },
  { name: 'Zonhoven', region: 'Belgisch Limburg', country: 'BE', lat: 50.9882, lng: 5.3687 },
  { name: 'As', region: 'Belgisch Limburg', country: 'BE', lat: 51.0076, lng: 5.5861 },
  { name: 'Oudsbergen', region: 'Belgisch Limburg', country: 'BE', lat: 51.0825, lng: 5.5392 },
  { name: 'Leopoldsburg', region: 'Belgisch Limburg', country: 'BE', lat: 51.1189, lng: 5.2605 },
  { name: 'Tessenderlo', region: 'Belgisch Limburg', country: 'BE', lat: 51.0681, lng: 5.0886 },
  { name: 'Ham', region: 'Belgisch Limburg', country: 'BE', lat: 51.1011, lng: 5.1764 },
  { name: 'Lummen', region: 'Belgisch Limburg', country: 'BE', lat: 50.9861, lng: 5.1919 },
  { name: 'Herk-de-Stad', region: 'Belgisch Limburg', country: 'BE', lat: 50.9406, lng: 5.1661 },
  { name: 'Halen', region: 'Belgisch Limburg', country: 'BE', lat: 50.9497, lng: 5.1136 },
  { name: 'Alken', region: 'Belgisch Limburg', country: 'BE', lat: 50.8756, lng: 5.3061 },
  { name: 'Kortessem', region: 'Belgisch Limburg', country: 'BE', lat: 50.8601, lng: 5.3908 },
  { name: 'Wellen', region: 'Belgisch Limburg', country: 'BE', lat: 50.8407, lng: 5.3387 },
  { name: 'Borgloon', region: 'Belgisch Limburg', country: 'BE', lat: 50.8028, lng: 5.3431 },
  { name: 'Sint-Truiden', region: 'Belgisch Limburg', country: 'BE', lat: 50.8164, lng: 5.1864 },
  { name: 'Tongeren', region: 'Belgisch Limburg', country: 'BE', lat: 50.7806, lng: 5.4648 },
  { name: 'Riemst', region: 'Belgisch Limburg', country: 'BE', lat: 50.8119, lng: 5.5975 },
  { name: 'Voeren', region: 'Belgisch Limburg', country: 'BE', lat: 50.7489, lng: 5.7533 },

  // --- PROVINCIE ANTWERPEN ---
  { name: 'Antwerpen', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2194, lng: 4.4025 },
  { name: 'Mortsel', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1711, lng: 4.4556 },
  { name: 'Borsbeek', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1928, lng: 4.4883 },
  { name: 'Edegem', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1572, lng: 4.4447 },
  { name: 'Kontich', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1342, lng: 4.4475 },
  { name: 'Boechout', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1611, lng: 4.4933 },
  { name: 'Schoten', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2514, lng: 4.4981 },
  { name: 'Brasschaat', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2936, lng: 4.4936 },
  { name: 'Kapellen', region: 'Provincie Antwerpen', country: 'BE', lat: 51.3144, lng: 4.4328 },
  { name: 'Kalmthout', region: 'Provincie Antwerpen', country: 'BE', lat: 51.3850, lng: 4.4750 },
  { name: 'Essen', region: 'Provincie Antwerpen', country: 'BE', lat: 51.4683, lng: 4.4708 },
  { name: 'Brecht', region: 'Provincie Antwerpen', country: 'BE', lat: 51.3503, lng: 4.6406 },
  { name: 'Schilde', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2403, lng: 4.5828 },
  { name: 'Zoersel', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2689, lng: 4.7139 },
  { name: 'Malle', region: 'Provincie Antwerpen', country: 'BE', lat: 51.3006, lng: 4.6936 },
  { name: 'Lier', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1313, lng: 4.5704 },
  { name: 'Nijlen', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1617, lng: 4.6703 },
  { name: 'Duffel', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0967, lng: 4.5092 },
  { name: 'Mechelen', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0257, lng: 4.4776 },
  { name: 'Willebroek', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0608, lng: 4.3606 },
  { name: 'Boom', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0886, lng: 4.3683 },
  { name: 'Bornem', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0967, lng: 4.2344 },
  { name: 'Puurs-Sint-Amands', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0772, lng: 4.2781 },
  { name: 'Heist-op-den-Berg', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0761, lng: 4.7292 },
  { name: 'Herentals', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1764, lng: 4.8361 },
  { name: 'Turnhout', region: 'Provincie Antwerpen', country: 'BE', lat: 51.3225, lng: 4.9447 },
  { name: 'Oud-Turnhout', region: 'Provincie Antwerpen', country: 'BE', lat: 51.3189, lng: 4.9819 },
  { name: 'Kasterlee', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2411, lng: 4.9686 },
  { name: 'Geel', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1611, lng: 4.9903 },
  { name: 'Mol', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1839, lng: 5.1167 },
  { name: 'Balen', region: 'Provincie Antwerpen', country: 'BE', lat: 51.1706, lng: 5.1706 },
  { name: 'Dessel', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2403, lng: 5.1158 },
  { name: 'Retie', region: 'Provincie Antwerpen', country: 'BE', lat: 51.2678, lng: 5.0839 },
  { name: 'Hoogstraten', region: 'Provincie Antwerpen', country: 'BE', lat: 51.3997, lng: 4.7619 },
  { name: 'Westerlo', region: 'Provincie Antwerpen', country: 'BE', lat: 51.0886, lng: 4.9150 },

  // --- VLAAMS-BRABANT & BRUSSEL ---
  { name: 'Leuven', region: 'Vlaams-Brabant', country: 'BE', lat: 50.8798, lng: 4.7005 },
  { name: 'Tienen', region: 'Vlaams-Brabant', country: 'BE', lat: 50.8078, lng: 4.9378 },
  { name: 'Diest', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9847, lng: 5.0514 },
  { name: 'Aarschot', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9867, lng: 4.8342 },
  { name: 'Scherpenheuvel-Zichem', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9797, lng: 4.9739 },
  { name: 'Rotselaar', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9525, lng: 4.7094 },
  { name: 'Haacht', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9769, lng: 4.6369 },
  { name: 'Herent', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9083, lng: 4.6736 },
  { name: 'Vilvoorde', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9281, lng: 4.4258 },
  { name: 'Grimbergen', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9339, lng: 4.3703 },
  { name: 'Zaventem', region: 'Vlaams-Brabant', country: 'BE', lat: 50.8833, lng: 4.4756 },
  { name: 'Tervuren', region: 'Vlaams-Brabant', country: 'BE', lat: 50.8239, lng: 4.5139 },
  { name: 'Overijse', region: 'Vlaams-Brabant', country: 'BE', lat: 50.7758, lng: 4.5367 },
  { name: 'Halle', region: 'Vlaams-Brabant', country: 'BE', lat: 50.7358, lng: 4.2369 },
  { name: 'Asse', region: 'Vlaams-Brabant', country: 'BE', lat: 50.9103, lng: 4.1972 },
  { name: 'Brussel (Bruxelles)', region: 'Brussel', country: 'BE', lat: 50.8503, lng: 4.3517 },

  // --- OOST-VLAANDEREN ---
  { name: 'Gent', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.0543, lng: 3.7174 },
  { name: 'Aalst', region: 'Oost-Vlaanderen', country: 'BE', lat: 50.9382, lng: 4.0392 },
  { name: 'Sint-Niklaas', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.1643, lng: 4.1396 },
  { name: 'Dendermonde', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.0317, lng: 4.0983 },
  { name: 'Lokeren', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.1039, lng: 3.9936 },
  { name: 'Beveren', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.2125, lng: 4.2561 },
  { name: 'Oudenaarde', region: 'Oost-Vlaanderen', country: 'BE', lat: 50.8441, lng: 3.6062 },
  { name: 'Deinze', region: 'Oost-Vlaanderen', country: 'BE', lat: 50.9839, lng: 3.5281 },
  { name: 'Eeklo', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.1856, lng: 3.5658 },
  { name: 'Geraardsbergen', region: 'Oost-Vlaanderen', country: 'BE', lat: 50.7711, lng: 3.8803 },
  { name: 'Ninove', region: 'Oost-Vlaanderen', country: 'BE', lat: 50.8353, lng: 4.0236 },
  { name: 'Ronse', region: 'Oost-Vlaanderen', country: 'BE', lat: 50.7497, lng: 3.6014 },
  { name: 'Wetteren', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.0067, lng: 3.8858 },
  { name: 'Aalter', region: 'Oost-Vlaanderen', country: 'BE', lat: 51.0833, lng: 3.4486 },

  // --- WEST-VLAANDEREN ---
  { name: 'Brugge', region: 'West-Vlaanderen', country: 'BE', lat: 51.2093, lng: 3.2247 },
  { name: 'Oostende', region: 'West-Vlaanderen', country: 'BE', lat: 51.2154, lng: 2.9287 },
  { name: 'Kortrijk', region: 'West-Vlaanderen', country: 'BE', lat: 50.8280, lng: 3.2649 },
  { name: 'Roeselare', region: 'West-Vlaanderen', country: 'BE', lat: 50.9445, lng: 3.1238 },
  { name: 'Ieper', region: 'West-Vlaanderen', country: 'BE', lat: 50.8514, lng: 2.8857 },
  { name: 'Knokke-Heist', region: 'West-Vlaanderen', country: 'BE', lat: 51.3414, lng: 3.2872 },
  { name: 'Blankenberge', region: 'West-Vlaanderen', country: 'BE', lat: 51.3131, lng: 3.1319 },
  { name: 'De Haan', region: 'West-Vlaanderen', country: 'BE', lat: 51.2728, lng: 3.0319 },
  { name: 'Nieuwpoort', region: 'West-Vlaanderen', country: 'BE', lat: 51.1306, lng: 2.7517 },
  { name: 'Koksijde', region: 'West-Vlaanderen', country: 'BE', lat: 51.1114, lng: 2.6489 },
  { name: 'De Panne', region: 'West-Vlaanderen', country: 'BE', lat: 51.0964, lng: 2.5897 },
  { name: 'Veurne', region: 'West-Vlaanderen', country: 'BE', lat: 51.0728, lng: 2.6628 },
  { name: 'Diksmuide', region: 'West-Vlaanderen', country: 'BE', lat: 51.0333, lng: 2.8647 },
  { name: 'Poperinge', region: 'West-Vlaanderen', country: 'BE', lat: 50.8556, lng: 2.7264 },
  { name: 'Waregem', region: 'West-Vlaanderen', country: 'BE', lat: 50.8872, lng: 3.4286 },
  { name: 'Tielt', region: 'West-Vlaanderen', country: 'BE', lat: 50.9997, lng: 3.3283 },
  { name: 'Torhout', region: 'West-Vlaanderen', country: 'BE', lat: 51.0664, lng: 3.1011 },
  { name: 'Damme', region: 'West-Vlaanderen', country: 'BE', lat: 51.2514, lng: 3.2828 },

  // --- NEDERLANDS LIMBURG ---
  { name: 'Maastricht', region: 'Nederlands Limburg', country: 'NL', lat: 50.8514, lng: 5.6909 },
  { name: 'Valkenburg', region: 'Nederlands Limburg', country: 'NL', lat: 50.8642, lng: 5.8317 },
  { name: 'Gulpen-Wittem', region: 'Nederlands Limburg', country: 'NL', lat: 50.8142, lng: 5.8906 },
  { name: 'Vaals', region: 'Nederlands Limburg', country: 'NL', lat: 50.7697, lng: 6.0183 },
  { name: 'Heerlen', region: 'Nederlands Limburg', country: 'NL', lat: 50.8882, lng: 5.9794 },
  { name: 'Kerkrade', region: 'Nederlands Limburg', country: 'NL', lat: 50.8658, lng: 6.0631 },
  { name: 'Sittard-Geleen', region: 'Nederlands Limburg', country: 'NL', lat: 50.9983, lng: 5.8697 },
  { name: 'Roermond', region: 'Nederlands Limburg', country: 'NL', lat: 51.1942, lng: 5.9875 },
  { name: 'Weert', region: 'Nederlands Limburg', country: 'NL', lat: 51.2517, lng: 5.7069 },
  { name: 'Venlo', region: 'Nederlands Limburg', country: 'NL', lat: 51.3700, lng: 6.1681 },
  { name: 'Venray', region: 'Nederlands Limburg', country: 'NL', lat: 51.5264, lng: 5.9753 },

  // --- NOORD-BRABANT (NL) ---
  { name: 'Eindhoven', region: 'Noord-Brabant', country: 'NL', lat: 51.4416, lng: 5.4697 },
  { name: 'Breda', region: 'Noord-Brabant', country: 'NL', lat: 51.5719, lng: 4.7683 },
  { name: 'Tilburg', region: 'Noord-Brabant', country: 'NL', lat: 51.5555, lng: 5.0913 },
  { name: "'s-Hertogenbosch", region: 'Noord-Brabant', country: 'NL', lat: 51.6978, lng: 5.3037 },
  { name: 'Helmond', region: 'Noord-Brabant', country: 'NL', lat: 51.4817, lng: 5.6575 },
  { name: 'Bergen op Zoom', region: 'Noord-Brabant', country: 'NL', lat: 51.4947, lng: 4.2872 },
  { name: 'Roosendaal', region: 'Noord-Brabant', country: 'NL', lat: 51.5308, lng: 4.4653 },
  { name: 'Valkenswaard', region: 'Noord-Brabant', country: 'NL', lat: 51.3503, lng: 5.4594 },
  { name: 'Eersel', region: 'Noord-Brabant', country: 'NL', lat: 51.3578, lng: 5.3150 },
  { name: 'Bergeijk', region: 'Noord-Brabant', country: 'NL', lat: 51.3208, lng: 5.3589 },
  { name: 'Baarle-Nassau', region: 'Noord-Brabant', country: 'NL', lat: 51.4439, lng: 4.9317 },

  // --- ZEELAND (NL) ---
  { name: 'Middelburg', region: 'Zeeland', country: 'NL', lat: 51.4988, lng: 3.6109 },
  { name: 'Vlissingen', region: 'Zeeland', country: 'NL', lat: 51.4542, lng: 3.5708 },
  { name: 'Goes', region: 'Zeeland', country: 'NL', lat: 51.5047, lng: 3.8889 },
  { name: 'Zierikzee', region: 'Zeeland', country: 'NL', lat: 51.6497, lng: 3.9169 },
  { name: 'Terneuzen', region: 'Zeeland', country: 'NL', lat: 51.3347, lng: 3.8294 },
  { name: 'Hulst', region: 'Zeeland', country: 'NL', lat: 51.2808, lng: 4.0536 },
  { name: 'Sluis', region: 'Zeeland', country: 'NL', lat: 51.3083, lng: 3.3889 },

  // --- ZUID-HOLLAND & UTRECHT & GELDERLAND (NL) ---
  { name: 'Rotterdam', region: 'Zuid-Holland', country: 'NL', lat: 51.9244, lng: 4.4777 },
  { name: 'Dordrecht', region: 'Zuid-Holland', country: 'NL', lat: 51.8133, lng: 4.6900 },
  { name: 'Utrecht', region: 'Utrecht', country: 'NL', lat: 52.0907, lng: 5.1214 },
  { name: 'Arnhem', region: 'Gelderland', country: 'NL', lat: 51.9851, lng: 5.8987 },
  { name: 'Nijmegen', region: 'Gelderland', country: 'NL', lat: 51.8426, lng: 5.8596 }
];

/**
 * Fast Euclidean distance approximation in km for quick spatial sorting
 */
function fastApproxDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 111.0;
  const avgLatRad = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * 111.0 * Math.cos(avgLatRad);
  return Math.hypot(dLat, dLon);
}

export interface ResolvedLocality {
  municipality: string;
  region: string;
  country: 'BE' | 'NL';
  distanceKm: number;
}

/**
 * Finds the nearest municipality and authentic region/province for any given coordinates in BE/NL.
 */
export function findNearestMunicipality(lat: number, lng: number): ResolvedLocality {
  let nearest: MunicipalityLocation = MUNICIPALITIES_DATABASE[0];
  let minDistance = Infinity;

  for (const item of MUNICIPALITIES_DATABASE) {
    const d = fastApproxDistanceKm(lat, lng, item.lat, item.lng);
    if (d < minDistance) {
      minDistance = d;
      nearest = item;
    }
  }

  return {
    municipality: nearest.name,
    region: nearest.region,
    country: nearest.country,
    distanceKm: Math.round(minDistance * 10) / 10
  };
}

/**
 * Enriches any knooppunt node with a clear, informative name, municipality, and authentic region.
 * For example:
 * - Knooppunt 14 in Zutendaal becomes:
 *   name: "Knooppunt 14 — Zutendaal"
 *   municipality: "Zutendaal"
 *   region: "Belgisch Limburg"
 */
export function enrichKnooppuntLocality<T extends {
  ref: string;
  lat: number;
  lng: number;
  name?: string;
  municipality?: string;
  region?: string;
  highlight?: string;
}>(node: T): T {
  const locality = findNearestMunicipality(node.lat, node.lng);

  // If node has no municipality or a generic one, use resolved municipality
  const municipality = node.municipality || locality.municipality;

  // Authentic region
  let region = node.region;
  if (!region || region === 'OSM Knooppuntennetwerk' || region.toLowerCase().includes('osm')) {
    region = locality.region;
  }

  // Meaningful display name
  let name = node.name;
  if (!name || name === `Knooppunt ${node.ref}` || name === node.ref || name === `Node ${node.ref}`) {
    name = `Knooppunt ${node.ref} — ${municipality}`;
  }

  return {
    ...node,
    name,
    municipality,
    region,
  };
}
