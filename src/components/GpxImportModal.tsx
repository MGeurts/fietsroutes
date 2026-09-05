import React, { useState, useRef } from 'react';
import { parseGpxFile } from '../services/routingService';
import { KnooppuntNode } from '../types';
import { Upload, FileText, Check, X, AlertCircle } from 'lucide-react';

interface GpxImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportGpx: (routeData: {
    name: string;
    coordinates: [number, number][];
    waypoints: { lat: number; lng: number; name: string }[];
  }) => void;
}

export const GpxImportModal: React.FC<GpxImportModalProps> = ({
  isOpen,
  onClose,
  onImportGpx,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.gpx') && !file.type.includes('xml')) {
      setError('Selecteer alstublieft een geldig .gpx bestand.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseGpxFile(text);
        if (parsed.coordinates.length === 0 && parsed.waypoints.length === 0) {
          setError('Kon geen trackpunten of waypoints vinden in dit GPX bestand.');
          return;
        }
        onImportGpx(parsed);
        onClose();
      } catch {
        setError('Fout bij het parsen van het GPX bestand.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Importeer GPX route</h2>
              <p className="text-[11px] text-slate-500">Upload een bestaande fietsroute of Garmin/Komoot bestand</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml,text/xml"
              onChange={handleChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-200">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              Sleep een .gpx bestand hierheen of <span className="text-emerald-700 underline">klik om te bladeren</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Geschikt voor Garmin, Wahoo, Strava, Komoot, Fietsnet en RouteYou
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
};
