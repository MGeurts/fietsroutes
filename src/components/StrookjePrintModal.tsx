import React, { useState } from 'react';
import { PlannedRoute, BikeType, KnooppuntNode } from '../types';
import { Printer, Copy, Check, X, ExternalLink, Download, AlertCircle } from 'lucide-react';

interface StrookjePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: PlannedRoute;
  selectedBike: BikeType;
  averageSpeedKmH: number;
}

interface StripNode {
  node: KnooppuntNode;
  automatic: boolean;
}

interface StripLeg {
  fromNode: KnooppuntNode;
  toNode: KnooppuntNode;
  distanceKm: number;
}

/** Expand each selected leg into every actual junction-to-junction hop. */
function buildStripRoute(route: PlannedRoute): { nodes: StripNode[]; legs: StripLeg[] } {
  const selectedNodeIds = new Set(route.nodes.map((node) => String(node.id)));
  const nodes: StripNode[] = [];
  const legs: StripLeg[] = [];
  const appendNode = (node: KnooppuntNode, automatic: boolean) => {
    const last = nodes[nodes.length - 1];
    if (last && String(last.node.id) === String(node.id)) {
      if (!automatic) last.automatic = false;
      return;
    }
    nodes.push({ node, automatic });
  };

  for (const leg of route.legs) {
    const segments = (leg.displaySegments || []).filter((segment) => segment.analysis);
    if (segments.length === 0) {
      appendNode(leg.fromNode, !selectedNodeIds.has(String(leg.fromNode.id)));
      appendNode(leg.toNode, !selectedNodeIds.has(String(leg.toNode.id)));
      legs.push({ fromNode: leg.fromNode, toNode: leg.toNode, distanceKm: leg.distanceKm });
      continue;
    }
    for (const segment of segments) {
      const analysis = segment.analysis!;
      appendNode(analysis.fromNode, !selectedNodeIds.has(String(analysis.fromNode.id)));
      appendNode(analysis.toNode, !selectedNodeIds.has(String(analysis.toNode.id)));
      legs.push({
        fromNode: analysis.fromNode,
        toNode: analysis.toNode,
        // Older saved routes may not yet have segment distances. Their total is
        // still shown accurately when they contain one visible segment.
        distanceKm: segment.distanceKm ?? (segments.length === 1 ? leg.distanceKm : 0),
      });
    }
  }

  if (nodes.length === 0 && route.nodes.length > 0) {
    route.nodes.forEach((node) => appendNode(node, false));
  }
  return { nodes, legs };
}

export const StrookjePrintModal: React.FC<StrookjePrintModalProps> = ({
  isOpen,
  onClose,
  route,
  averageSpeedKmH,
}) => {
  const [copied, setCopied] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [showHelpNotice, setShowHelpNotice] = useState(false);

  if (!isOpen) return null;

  const durationHours = route.totalDistanceKm / averageSpeedKmH;
  const hours = Math.floor(durationHours);
  const minutes = Math.round((durationHours - hours) * 60);
  const stripRoute = buildStripRoute(route);

  // Generate plain text format for easy sharing
  const textSummary = `🚴 ${route.name} (${route.totalDistanceKm} km - ca. ${hours}u${minutes > 0 ? ` ${minutes}m` : ''})\n` +
    `Knooppunten: ${stripRoute.nodes.map(({ node }) => node.ref).join(' ➔ ')}\n\n` +
    stripRoute.legs.map((leg, i) => `${i + 1}. [${leg.fromNode.ref}] ➔ ${leg.distanceKm} km ➔ [${leg.toNode.ref}]${leg.toNode.name ? ` (${leg.toNode.name})` : ''}`).join('\n') +
    `\n\nGemaakt met Fietsroute Planner NL & BE (OpenStreetMap & Knooppuntennetwerk)`;

  const handleCopy = () => {
    navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Generate self-contained, standalone printable HTML
  const generatePrintableHtml = () => {
    return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8"/>
  <title>${route.name} - Fietsknooppuntenstrookje</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #1e293b;
      background: #ffffff;
    }
    .print-actions {
      margin-bottom: 20px;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    @media print {
      .print-actions { display: none !important; }
      body { padding: 0 !important; }
    }
    .btn-print {
      background: #059669;
      color: white;
      font-weight: 700;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    /* Stuurpen strookje (smal formaat: ca. 78mm) */
    .stuurpen-strip {
      width: 78mm;
      max-width: 100%;
      border: 2px dashed #059669;
      border-radius: 10px;
      padding: 12px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .cut-line {
      font-size: 10px;
      color: #64748b;
      text-align: center;
      margin-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 4px;
      font-weight: 600;
    }
    .strip-header {
      border-bottom: 2px solid #059669;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .badge-route {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .route-title {
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      margin: 4px 0 2px;
      line-height: 1.2;
    }
    .route-meta {
      font-size: 11px;
      font-weight: 700;
      color: #059669;
      display: flex;
      justify-content: space-between;
    }
    .nodes-grid {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 6px 0;
    }
    .node-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .node-badge {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #ffffff;
      color: #047857;
      border: 2.5px solid #059669;
      font-weight: 800;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }
    .node-badge.automatic {
      color: #475569;
      border-color: #64748b;
      background: #f8fafc;
    }
    .leg-arrow {
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 9px;
      color: #475569;
      font-weight: 700;
      line-height: 1;
    }
    .strip-footer {
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">🖨️ Nu Afdrukken</button>
    <span style="font-size: 13px; color: #475569;">Strokje voor bevestiging op je fietsstuur (knooppunten op volgorde).</span>
  </div>

  <div class="container">
    <div class="stuurpen-strip">
      <div class="cut-line">✂ Knip hier uit voor stuurpen / stuurtas</div>
      <div class="strip-header">
        <span class="badge-route">Fietsknooppunten</span>
        <div class="route-title">${route.name}</div>
        <div class="route-meta">
          <span>${route.totalDistanceKm} km</span>
          <span>ca. ${hours}u ${minutes}m</span>
        </div>
      </div>

      <div class="nodes-grid">
        ${stripRoute.nodes.map(({ node, automatic }, i) => {
          const leg = stripRoute.legs[i];
          return `
            <div class="node-item">
              <div class="node-badge${automatic ? ' automatic' : ''}" title="${automatic ? 'Automatisch tussenknooppunt' : 'Gekozen knooppunt'}">${node.ref}</div>
              ${leg ? `
                <div class="leg-arrow">
                  <span>➔</span>
                  <span>${leg.distanceKm}k</span>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <div class="strip-footer">
        <span>OpenStreetMap &bull; Knooppunten</span>
        <span>${new Date().toLocaleDateString('nl-NL')}</span>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`;
  };

  // Primary Print Action: tries hidden iframe print + window.print()
  const handlePrint = () => {
    setPrintStatus('Afdrukken voorbereiden...');
    setShowHelpNotice(true);

    try {
      // 1. Create a hidden print iframe (works best across modern browsers and sandboxes)
      const existingIframe = document.getElementById('strookje-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'strookje-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '10px';
      iframe.style.height = '10px';
      iframe.style.border = '0';
      iframe.style.opacity = '0.01';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(generatePrintableHtml());
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setPrintStatus('Afdrukvenster geopend!');
          } catch (iframeErr) {
            console.warn('Iframe print error, falling back to window.print()', iframeErr);
            window.print();
            setPrintStatus('Afdrukvenster geopend!');
          }
        }, 350);
      } else {
        window.print();
        setPrintStatus('Afdrukvenster geopend!');
      }
    } catch (err) {
      console.warn('Print trigger error:', err);
      // Fallback
      window.print();
      setPrintStatus('Afdrukvenster geopend!');
    }

    setTimeout(() => {
      setPrintStatus(null);
    }, 4000);
  };

  // Open standalone print version in a new tab (bypasses iframe sandbox restrictions completely)
  const handleOpenInNewTab = () => {
    const html = generatePrintableHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newTab = window.open(url, '_blank');
    if (!newTab) {
      // If popup blocker blocked it, trigger download
      handleDownloadHtml();
    }
  };

  // Download standalone HTML file
  const handleDownloadHtml = () => {
    const html = generatePrintableHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knooppunten-strookje-${route.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPrintStatus('HTML-printbestand gedownload!');
    setTimeout(() => setPrintStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans strookje-modal-backdrop">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden strookje-modal-container">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              KP
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Fietsknooppunten-strookje</h2>
              <p className="text-[11px] text-slate-500">Klassiek stuurbordstrookje om op je fietsstuur te bevestigen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Printable Area */}
        <div className="p-6 overflow-y-auto space-y-6 strookje-modal-scroll">
          {/* Status Message */}
          {printStatus && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 font-medium animate-in fade-in no-print">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{printStatus}</span>
            </div>
          )}

          {/* Printable Strip Card */}
          <div
            id="printable-strookje"
            className="border-2 border-dashed border-emerald-500 rounded-xl p-5 bg-white shadow-xs space-y-4 print:border-solid print:m-0 print:p-4"
          >
            {/* Strip Header */}
            <div className="flex items-start justify-between border-b pb-3 border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Knooppuntenroute
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">{route.name}</h3>
                <p className="text-xs text-slate-500">
                  {route.nodes[0]?.municipality || 'Vertrek'} &bull; OpenStreetMap Netwerk
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-emerald-700">{route.totalDistanceKm} <span className="text-sm font-semibold">km</span></div>
                <div className="text-xs text-slate-500 font-medium">ca. {hours}u {minutes}m</div>
              </div>
            </div>

            {/* Visual Node Badges Flow */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Volgorde op het stuur ({stripRoute.nodes.length} knooppunten) <span className="normal-case font-medium text-slate-400">• grijs = automatisch tussenpunt</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 py-2">
                {stripRoute.nodes.map(({ node, automatic }, index) => {
                  const nextLeg = stripRoute.legs[index];
                  return (
                    <React.Fragment key={`${node.ref}-${index}`}>
                      <div className="flex items-center gap-1.5">
                        <div title={automatic ? 'Automatisch tussenknooppunt' : 'Gekozen knooppunt'} className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center shadow-xs border-2 shrink-0 ${automatic ? 'bg-slate-100 text-slate-700 border-slate-500' : 'bg-white text-emerald-700 border-emerald-500'}`}>
                          {node.ref}
                        </div>
                        {nextLeg && (
                          <div className="flex flex-col items-center px-1">
                            <span className="text-[10px] font-bold text-slate-600 leading-none">➔</span>
                            <span className="text-[9px] font-medium text-slate-500">{nextLeg.distanceKm} km</span>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>https://github.com/MGeurts/fietsroute</span>
              <span>OpenStreetMap &bull; Fietsknooppunten NL &amp; BE</span>
            </div>
          </div>

          {/* Quick instructions & Iframe sandbox notice */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2 no-print">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">💡 Tip voor onderweg:</span>
              <span className="text-[11px] text-emerald-700 font-medium">Waterdicht &amp; batterijloos</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Print dit strookje af, knip het uit en plak het met een stukje transparante tape op je stuurpen of stuurtas. Zo heb je de knooppunten altijd direct in het zicht!
            </p>

            {/* Direct fallback buttons if iframe blocks print dialog */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-500">Doet de printknop niets in uw browser?</span>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in nieuw tabblad</span>
              </button>
              <span className="text-slate-300">&bull;</span>
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold hover:underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download HTML-bestand</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 no-print">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition shadow-xs cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Gekopieerd!' : 'Kopieer tekst'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              title="Open printversie in een nieuw venster"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition shadow-xs cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span>Nieuw venster</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Sluiten
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print strookje</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

