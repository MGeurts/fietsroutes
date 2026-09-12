import React from 'react';
import { ExternalLink, Github, X } from 'lucide-react';
import { APP_VERSION } from '../appVersion';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REPOSITORY_URL = 'https://github.com/MGeurts/fietsroutes';

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <div className="flex justify-end p-3 pb-0">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg">
            <img src="/fietsroute-logo.png" alt="FietsRoute.io-logo" className="h-24 w-24 object-contain" />
          </div>
          <h2 id="about-title" className="mt-4 text-xl font-bold text-slate-900">FietsRoute.io</h2>
          <p className="mt-1 text-sm text-slate-500">Knooppuntennetwerk Nederland &amp; België</p>

          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            Versie <strong>{APP_VERSION}</strong>
          </div>

          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Github className="w-4 h-4" />
            Bekijk op GitHub
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
