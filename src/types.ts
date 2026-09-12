export interface KnooppuntNode {
  id: string | number;
  ref: string; // The number, e.g. "91", "64", "01"
  lat: number;
  lng: number;
  name?: string;
  municipality?: string;
  region?: string; // e.g. "Belgisch Limburg", "Nederlands Limburg", "Antwerpen"
  highlight?: string; // e.g. "Fietsen door het Water", "Nationaal Park Hoge Kempen"
}

export interface RouteLeg {
  fromNode: KnooppuntNode;
  toNode: KnooppuntNode;
  distanceKm: number;
  coordinates: [number, number][]; // [lat, lng] path
  instructions?: string;
  /** False when a live bicycle router supplied road geometry because the static node graph has a gap. */
  isVerified?: boolean;
  /** Segments are kept separate so the map can show their individual provenance. */
  displaySegments?: RouteDisplaySegment[];
}

export type RouteGeometrySource = 'official' | 'official-declared' | 'brouter' | 'osm-router';

export interface RouteDisplaySegment {
  coordinates: [number, number][];
  /** Length of this individual junction-to-junction segment. */
  distanceKm?: number;
  source: RouteGeometrySource;
  /** Evidence carried to the map click handler; never inferred from a node number alone. */
  analysis?: RouteConnectionAnalysis;
}

export interface RouteConnectionAnalysis {
  fromNode: KnooppuntNode;
  toNode: KnooppuntNode;
  source: string;
  /** The actual geometry shown on the map, independent of the raw OSM relation status. */
  geometrySource?: RouteGeometrySource;
  relationId?: number;
}

export interface ElevationPoint {
  distance: number; // km from start
  elevation: number; // meters
}

export interface ElevationProfileResult {
  points: ElevationPoint[];
  totalAscent: number;
  available: boolean;
}

export interface OfficialNetworkDatasetEdge {
  from: string;
  to: string;
  distanceKm: number;
  coordinates: [number, number][];
  source: string;
  verifiedAt: string;
}

/** A signed OSM Node-to-Node relation with explicit endpoints, but no safely assembled geometry. */
export interface OfficialNetworkDeclaredConnection {
  from: string;
  to: string;
  source: string;
}

/**
 * Build-time evidence for an OSM route relation.  This stays separate from the
 * browser dataset so the planner remains small, while every skipped relation can
 * be inspected in the generated validation report.
 */
export interface OfficialNetworkValidationEntry {
  relationId: number;
  country: string;
  ref?: string;
  /** The endpoints used by the importer, when they could be resolved safely. */
  from?: OfficialNetworkValidationEndpoint;
  to?: OfficialNetworkValidationEndpoint;
  status: 'verified-geometry' | 'declared-topology' | 'rejected';
  reason?: string;
}

export interface OfficialNetworkValidationEndpoint {
  id: string;
  ref: string;
  lat: number;
  lng: number;
}

export interface OfficialNetworkValidationReport {
  version: 1;
  generatedAt: string;
  summary: {
    examined: number;
    verifiedGeometry: number;
    declaredTopology: number;
    rejected: number;
    reasons: Record<string, number>;
  };
  entries: OfficialNetworkValidationEntry[];
}

/** A detailed official segment graph, currently supplied by Rijkswaterstaat for NL. */
export interface OfficialNetworkTopologyVertex {
  id: string;
  lat: number;
  lng: number;
}

export interface OfficialNetworkTopologyEdge {
  from: string;
  to: string;
  distanceKm: number;
  coordinates: [number, number][];
  source: string;
}

export interface OfficialNetworkTopology {
  vertices: OfficialNetworkTopologyVertex[];
  edges: OfficialNetworkTopologyEdge[];
  /** Maps a stable OSM knooppunt id to its verified topology vertex. */
  anchors: Record<string, string>;
}

export interface OfficialNetworkDataset {
  version: 1;
  generatedAt: string;
  nodes: KnooppuntNode[];
  edges: OfficialNetworkDatasetEdge[];
  declaredConnections?: OfficialNetworkDeclaredConnection[];
  topology?: OfficialNetworkTopology;
}

/** Small companion file used to validate the browser's IndexedDB copy before the
 * considerably larger network graph is requested again. */
export interface OfficialNetworkDatasetManifest {
  version: 1;
  generatedAt: string;
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

export type MapTileProvider = 'cyclemap' | 'standard' | 'cyclosm' | 'osm_waymarked' | 'topo';

export interface MapLayerOption {
  id: MapTileProvider;
  name: string;
  description: string;
  badge?: string;
}
