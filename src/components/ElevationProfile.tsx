import React from 'react';
import { ElevationPoint } from '../types';
import { Mountain, ArrowUpRight } from 'lucide-react';

interface ElevationProfileProps {
  elevationPoints: ElevationPoint[];
  totalDistanceKm: number;
  totalAscentM: number;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  elevationPoints,
  totalDistanceKm,
  totalAscentM,
}) => {
  if (!elevationPoints || elevationPoints.length < 2) return null;

  const elevations = elevationPoints.map((p) => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const range = Math.max(15, maxElev - minElev);

  const width = 400;
  const height = 90;
  const paddingX = 15;
  const paddingY = 12;

  const getX = (dist: number) => {
    return paddingX + (dist / (totalDistanceKm || 1)) * (width - 2 * paddingX);
  };

  const getY = (elev: number) => {
    return height - paddingY - ((elev - minElev) / range) * (height - 2 * paddingY);
  };

  const pointsStr = elevationPoints
    .map((p) => `${getX(p.distance)},${getY(p.elevation)}`)
    .join(' ');

  const areaStr = `${pointsStr} ${getX(totalDistanceKm)},${height} ${getX(0)},${height}`;

  return (
    <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Mountain className="w-3.5 h-3.5 text-emerald-600" />
          <span>Hoogteprofiel</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-0.5 text-emerald-700 font-semibold">
            <ArrowUpRight className="w-3 h-3" /> +{totalAscentM} m
          </span>
          <span>&bull;</span>
          <span>{minElev}m - {maxElev}m</span>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-18 select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <polygon points={areaStr} fill="url(#elevGradient)" />

          {/* Line */}
          <polyline
            points={pointsStr}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Baseline grid */}
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#f1f5f9"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        </svg>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
        <span>0 km ({minElev}m)</span>
        <span>{Math.round(totalDistanceKm / 2)} km</span>
        <span>{totalDistanceKm} km ({elevationPoints[elevationPoints.length - 1]?.elevation || minElev}m)</span>
      </div>

      <p className="text-[9px] text-slate-400">
        Terreinhoogte: Copernicus DEM via{' '}
        <a
          href="https://open-meteo.com/en/docs/elevation-api"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-slate-600"
        >
          Open-Meteo
        </a>
      </p>
    </div>
  );
};
