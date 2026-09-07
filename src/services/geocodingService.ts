export interface PlaceSearchResult {
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  type?: string;
  isCity?: boolean;
}

// Well-known major cycling hubs & cities in Flanders and the Netherlands
// for instantaneous (0ms) search suggestions
export const PRELOADED_MAJOR_PLACES: PlaceSearchResult[] = [
  // West-Vlaanderen
  {
    title: 'Brugge',
    subtitle: 'West-Vlaanderen, Vlaanderen, België',
    lat: 51.2093,
    lng: 3.2247,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Oostende',
    subtitle: 'Kust & West-Vlaanderen, België',
    lat: 51.2154,
    lng: 2.9287,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Kortrijk',
    subtitle: 'Leiestreek, West-Vlaanderen, België',
    lat: 50.8280,
    lng: 3.2649,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Ieper',
    subtitle: 'Westhoek, West-Vlaanderen, België',
    lat: 50.8514,
    lng: 2.8857,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Roeselare',
    subtitle: 'West-Vlaanderen, België',
    lat: 50.9445,
    lng: 3.1238,
    type: 'city',
    isCity: true,
  },

  // Oost-Vlaanderen
  {
    title: 'Gent',
    subtitle: 'Oost-Vlaanderen, België',
    lat: 51.0543,
    lng: 3.7174,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Aalst',
    subtitle: 'Oost-Vlaanderen, België',
    lat: 50.9382,
    lng: 4.0392,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Sint-Niklaas',
    subtitle: 'Waasland, Oost-Vlaanderen, België',
    lat: 51.1643,
    lng: 4.1396,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Oudenaarde',
    subtitle: 'Vlaamse Ardennen, Oost-Vlaanderen, België',
    lat: 50.8441,
    lng: 3.6062,
    type: 'city',
    isCity: true,
  },

  // Antwerpen
  {
    title: 'Antwerpen',
    subtitle: 'Provincie Antwerpen, België',
    lat: 51.2194,
    lng: 4.4025,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Mechelen',
    subtitle: 'Provincie Antwerpen, België',
    lat: 51.0257,
    lng: 4.4776,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Turnhout',
    subtitle: 'Kempen, Provincie Antwerpen, België',
    lat: 51.3225,
    lng: 4.9447,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Lier',
    subtitle: 'Provincie Antwerpen, België',
    lat: 51.1313,
    lng: 4.5704,
    type: 'city',
    isCity: true,
  },

  // Vlaams-Brabant & Brussel
  {
    title: 'Leuven',
    subtitle: 'Vlaams-Brabant, België',
    lat: 50.8798,
    lng: 4.7005,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Brussel (Bruxelles)',
    subtitle: 'Hoofdstedelijk Gewest, België',
    lat: 50.8503,
    lng: 4.3517,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Tienen',
    subtitle: 'Vlaams-Brabant, België',
    lat: 50.8078,
    lng: 4.9378,
    type: 'city',
    isCity: true,
  },

  // Belgisch Limburg
  {
    title: 'Hasselt',
    subtitle: 'Limburg, België',
    lat: 50.9307,
    lng: 5.3378,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Genk',
    subtitle: 'Limburg, België',
    lat: 50.9655,
    lng: 5.5008,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Tongeren',
    subtitle: 'Oudste stad van België, Limburg',
    lat: 50.7806,
    lng: 5.4648,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Zutendaal',
    subtitle: 'Groenste snoepje van Vlaanderen, Limburg',
    lat: 50.9324,
    lng: 5.5724,
    type: 'town',
    isCity: true,
  },
  {
    title: 'Bilzen',
    subtitle: 'Alden Biesen, Limburg, België',
    lat: 50.8708,
    lng: 5.5175,
    type: 'town',
    isCity: true,
  },
  {
    title: 'Lanaken',
    subtitle: 'Nationaal Park Hoge Kempen, Limburg',
    lat: 50.8911,
    lng: 5.6515,
    type: 'town',
    isCity: true,
  },
  {
    title: 'Sint-Truiden',
    subtitle: 'Haspengouw, Limburg, België',
    lat: 50.8164,
    lng: 5.1864,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Lommel',
    subtitle: 'Bosland & Sahara, Limburg, België',
    lat: 51.2307,
    lng: 5.3134,
    type: 'city',
    isCity: true,
  },

  // Nederland (Belangrijke grens- en fietsregio's)
  {
    title: 'Maastricht',
    subtitle: 'Limburg, Nederland',
    lat: 50.8514,
    lng: 5.6909,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Eindhoven',
    subtitle: 'Noord-Brabant, Nederland',
    lat: 51.4416,
    lng: 5.4697,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Breda',
    subtitle: 'Noord-Brabant, Nederland',
    lat: 51.5719,
    lng: 4.7683,
    type: 'city',
    isCity: true,
  },
  {
    title: "'s-Hertogenbosch",
    subtitle: 'Noord-Brabant, Nederland',
    lat: 51.6978,
    lng: 5.3037,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Utrecht',
    subtitle: 'Utrecht, Nederland',
    lat: 52.0907,
    lng: 5.1214,
    type: 'city',
    isCity: true,
  },
  {
    title: 'Middelburg',
    subtitle: 'Zeeland, Nederland',
    lat: 51.4988,
    lng: 3.6109,
    type: 'city',
    isCity: true,
  },
];

// In-memory cache for recent geocoding searches
const geocodeCache = new Map<string, PlaceSearchResult[]>();

/**
 * Determines whether a search string looks like a knooppunt reference (e.g. '131', 'kp 42', 'node 5', '12a')
 * or a town/address name ('Brugge', 'Gent', 'Steenstraat', etc.)
 */
export function isKnooppuntQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  // Pure digits: '131', '01', '7'
  if (/^\d{1,4}$/.test(trimmed)) return true;

  // Explicit prefix: 'kp 131', 'knooppunt 42', 'node 5'
  if (/^(?:knooppunt|kp\.?|node)\s*\d{1,4}[a-z]?$/i.test(trimmed)) return true;

  // Short alphanumeric code with digits: e.g. '42a', '12b', 'w01'
  if (/^[a-z]?\d{1,3}[a-z]?$/i.test(trimmed)) return true;

  // If it is purely letters and longer than 2 characters (e.g. "brugge", "gent", "antwerpen"),
  // it is definitely a place or address, NOT a knooppunt number!
  return false;
}

/**
 * Search places and addresses in Belgium and the Netherlands.
 * Combines instant local database with live Nominatim geocoding.
 */
export async function searchPlacesAndAddresses(
  rawQuery: string,
  limit: number = 5,
  signal?: AbortSignal
): Promise<PlaceSearchResult[]> {
  const q = rawQuery.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  // Check cache
  if (geocodeCache.has(q)) {
    return geocodeCache.get(q)!.slice(0, limit);
  }

  // 1. Instant match against curated list of major cities & towns
  const localMatches = PRELOADED_MAJOR_PLACES.filter(
    (p) =>
      p.title.toLowerCase().startsWith(q) ||
      p.title.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q)
  );

  // If query is an exact match for a major city, prioritize it
  const exactLocalMatch = localMatches.find(
    (p) => p.title.toLowerCase() === q || p.title.toLowerCase().startsWith(q)
  );

  // 2. Fetch live from OpenStreetMap Nominatim for exact addresses, streets and smaller villages
  let remoteResults: PlaceSearchResult[] = [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      rawQuery
    )}&countrycodes=be,nl&limit=${limit + 2}&addressdetails=1`;

    const res = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        remoteResults = data.map((item: any) => {
          const parts = (item.display_name || '').split(',').map((s: string) => s.trim());
          const title = parts[0] || rawQuery;
          const subtitle = parts.slice(1).slice(0, 3).join(', ');
          const isCity = ['city', 'town', 'municipality', 'village', 'administrative'].includes(
            item.type || item.addresstype
          );

          return {
            title,
            subtitle,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: item.type || item.addresstype || 'location',
            isCity,
          };
        });
      }
    }
  } catch (err) {
    // Stale or aborted request or network issue
    if (signal?.aborted) return localMatches.slice(0, limit);
  }

  // 3. Merge results, placing exact/local matches at the front and avoiding duplicates
  const combined: PlaceSearchResult[] = [];
  const seenCoordinates = new Set<string>();

  const addUnique = (item: PlaceSearchResult) => {
    const coordKey = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
    if (!seenCoordinates.has(coordKey)) {
      seenCoordinates.add(coordKey);
      combined.push(item);
    }
  };

  if (exactLocalMatch) {
    addUnique(exactLocalMatch);
  }

  localMatches.forEach(addUnique);
  remoteResults.forEach(addUnique);

  const finalResults = combined.slice(0, limit);
  geocodeCache.set(q, finalResults);
  return finalResults;
}
