export interface KnooppuntNode {
  id: string | number;
  ref: string; // The number, e.g. "91", "64", "01"
  lat: number;
  lng: number;
  name?: string;
  municipality?: string;
  region?: string; // e.g. "Belgisch Limburg", "Nederlands Limburg", "Antwerpen"
  highlight?: string; // e.g. "Fietsen door het Water", "Nationaal Park Hoge Kempen"
  connections?: string[]; // connected node numbers
}

export interface RouteLeg {
  fromNode: KnooppuntNode;
  toNode: KnooppuntNode;
  distanceKm: number;
  coordinates: [number, number][]; // [lat, lng] path
  instructions?: string;
}

export interface ElevationPoint {
  distance: number; // km from start
  elevation: number; // meters
}

export interface PlannedRoute {
  id: string;
  name: string;
  nodes: KnooppuntNode[];
  legs: RouteLeg[];
  fullCoordinates: [number, number][];
  totalDistanceKm: number;
  elevationGainM: number;
  elevationPoints: ElevationPoint[];
  createdAt: string;
}

export type BikeType = 'stadsfiets' | 'ebike' | 'racefiets' | 'gravel';

export interface BikeProfile {
  id: BikeType;
  label: string;
  averageSpeedKmH: number;
  iconName: string;
}

export type MapTileProvider = 'cyclosm' | 'osm_waymarked' | 'voyager_waymarked' | 'topo';

export interface MapLayerOption {
  id: MapTileProvider;
  name: string;
  description: string;
  badge?: string;
}
