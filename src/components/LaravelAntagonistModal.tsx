import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Server,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';

interface LaravelAntagonistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = 'overview' | 'antagonist' | 'php';

const buildCommand = `npm install
npm run build`;

export const LaravelAntagonistModal: React.FC<LaravelAntagonistModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('overview');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyBuildCommand = async () => {
    await navigator.clipboard.writeText(buildCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const tabClass = (tab: GuideTab, color: string) => (
    `px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
      activeTab === tab
        ? `bg-white text-slate-900 border-t-2 ${color} shadow-xs`
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
    }`
  );

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-xs overflow-hidden">
              <img src="/favicon.png" alt="" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Hosting &amp; PHP-handleiding</h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Statische productiebuild</span>
              </div>
              <p className="text-[11px] text-slate-500">Actueel voor FietsRoute.io 1.3.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer" aria-label="Sluiten">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-100/70 px-4 pt-2 gap-1 overflow-x-auto text-xs">
          <button onClick={() => setActiveTab('overview')} className={tabClass('overview', 'border-emerald-600')}>
            <Server className="w-3.5 h-3.5 text-emerald-600" /><span>Overzicht</span>
          </button>
          <button onClick={() => setActiveTab('antagonist')} className={tabClass('antagonist', 'border-sky-600')}>
            <HardDrive className="w-3.5 h-3.5 text-sky-600" /><span>Antagonist</span>
          </button>
          <button onClick={() => setActiveTab('php')} className={tabClass('php', 'border-amber-600')}>
            <Zap className="w-3.5 h-3.5 text-amber-600" /><span>PHP of Laravel Herd</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs text-slate-700 leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">Klaar voor statische hosting</h3>
                  <p className="text-emerald-900 mt-1">FietsRoute.io wordt met Vite gebouwd tot gewone HTML-, CSS-, JavaScript- en databestanden in <code>dist/</code>. Een Node.js-proces, Laravel-app of MySQL-database is niet nodig om de planner te gebruiken.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoCard icon={<FolderOpen className="w-4 h-4 text-emerald-600" />} title="Te publiceren map">
                  Publiceer altijd de <strong>inhoud</strong> van <code>dist/</code>, inclusief <code>data/</code>, <code>favicon.png</code> en de bestanden in <code>assets/</code>.
                </InfoCard>
                <InfoCard icon={<Database className="w-4 h-4 text-blue-600" />} title="Netwerkdataset">
                  De gecontroleerde knooppuntengegevens staan lokaal in <code>dist/data/</code>. Laat die map dus ongewijzigd mee uploaden.
                </InfoCard>
                <InfoCard icon={<ShieldCheck className="w-4 h-4 text-violet-600" />} title="Server vereist">
                  Elke gewone webserver volstaat: Apache, Nginx, statische hosting of een PHP-hostingpakket.
                </InfoCard>
                <InfoCard icon={<Zap className="w-4 h-4 text-amber-600" />} title="Internet in de browser">
                  Kaarttegels, plaatszoekopdrachten, hoogtegegevens en eventuele live-routering gebruiken externe diensten.
                </InfoCard>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-900">Lokale productiebuild</span>
                  <button onClick={copyBuildCommand} className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition cursor-pointer">
                    {copied ? 'Gekopieerd' : 'Kopieer commando'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto">{buildCommand}</pre>
              </div>
            </div>
          )}

          {activeTab === 'antagonist' && (
            <div className="space-y-4">
              <div className="p-4 bg-sky-50 rounded-xl border border-sky-200 flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-sky-950">Aanbevolen: statisch publiceren</h3>
                  <p className="text-sky-900 mt-1">Voor deze app hoef je op Antagonist geen Node.js-selector, Laravel of database te configureren. Bouw lokaal of in CI en upload daarna de inhoud van <code>dist/</code>.</p>
                </div>
              </div>

              <ol className="space-y-3 list-none">
                <DeployStep number="1" title="Bouw de app">Voer lokaal <code>npm install</code> en <code>npm run build</code> uit.</DeployStep>
                <DeployStep number="2" title="Open de webruimte">Open in DirectAdmin de bestandsbeheerder of gebruik je eigen FTPS/SFTP-client.</DeployStep>
                <DeployStep number="3" title="Upload de inhoud van dist/">Kopieer de bestanden en mappen uit <code>dist/</code> naar de documentroot van het domein, vaak <code>public_html/</code>. Upload niet alleen <code>index.html</code>.</DeployStep>
                <DeployStep number="4" title="Controleer de dataset">Open na de upload je domein en controleer of kaart en knooppunten laden. De map <code>data/</code> moet publiek bereikbaar blijven.</DeployStep>
              </ol>

              <p className="text-[11px] text-slate-500">Antagonist biedt ook Node.js-hosting aan, maar dat is voor deze vooraf gebouwde, statische app niet nodig.{' '}
                <a href="https://www.antagonist.nl/nodejs/" target="_blank" rel="noreferrer" className="text-sky-700 font-semibold hover:underline inline-flex items-center gap-1">Officiële Antagonist-informatie <ExternalLink className="w-3 h-3" /></a>
              </p>
            </div>
          )}

          {activeTab === 'php' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-950">PHP is optioneel</h3>
                  <p className="text-amber-900 mt-1">Het meegeleverde <code>index.php</code> kan de inhoud van <code>dist/</code> serveren op PHP-hosting of lokaal via Laravel Herd. Voor een gewone statische upload heb je dit bestand niet nodig.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoCard icon={<Zap className="w-4 h-4 text-amber-600" />} title="Laravel Herd (lokaal)">
                  <ol className="list-decimal list-inside space-y-1"><li>Koppel de projectmap in Herd, bijvoorbeeld met <code>herd link fietsroute</code>.</li><li>Voer <code>npm run build</code> uit.</li><li>Open het Herd-domein; <code>index.php</code> serveert vervolgens de productiebuild.</li></ol>
                </InfoCard>
                <InfoCard icon={<Database className="w-4 h-4 text-slate-600" />} title="Wat deze app niet bevat">
                  Er is geen ingebouwde Laravel-controller, MySQL-opslag, route-API of serverzijde gebruikersbeheer. Routes en GPX-bestanden worden in de browser samengesteld, geïmporteerd en geëxporteerd.
                </InfoCard>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl text-slate-200 space-y-1.5">
                <h3 className="font-bold text-white">Wanneer is een backend wél nodig?</h3>
                <p>Alleen als je later gedeelde, opgeslagen routes, accounts of een eigen database wilt toevoegen. Dat is een aparte uitbreiding en geen vereiste voor de huidige planner.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <a href="https://github.com/MGeurts/fietsroutes" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-600 hover:text-emerald-700 font-semibold">
            <span>Open MGeurts/fietsroutes op GitHub</span><ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md shadow-xs transition cursor-pointer">Sluiten</button>
        </div>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
    {icon}
    <h3 className="font-bold text-slate-900">{title}</h3>
    <div className="text-slate-600">{children}</div>
  </div>
);

const DeployStep: React.FC<{ number: string; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
  <li className="flex gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0">{number}</span>
    <div><strong className="text-slate-900">{title}</strong><p className="text-slate-600 mt-0.5">{children}</p></div>
  </li>
);
