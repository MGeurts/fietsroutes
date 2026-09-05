import React, { useState } from 'react';
import { Server, Code, Copy, Check, X, ShieldCheck, Database, ExternalLink, GitBranch, Zap } from 'lucide-react';

interface LaravelAntagonistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LaravelAntagonistModal: React.FC<LaravelAntagonistModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'herd' | 'laravel' | 'php_simple' | 'htaccess' | 'github_actions'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const codeSnippets = {
    // Laravel Controller
    laravelController: `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;
use App\\Models\\Fietsroute;
use Illuminate\\Support\\Str;

class FietsrouteController extends Controller
{
    /**
     * Toon de interactieve fietsroute planner
     */
    public function index()
    {
        return view('fietsroute');
    }

    /**
     * Bewaar een samengestelde fietsknooppunten route in MySQL (Antagonist)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'nodes' => 'required|array',
            'total_distance_km' => 'required|numeric',
            'gpx_data' => 'nullable|string',
        ]);

        $route = Fietsroute::create([
            'slug' => Str::slug($validated['name']) . '-' . Str::random(6),
            'name' => $validated['name'],
            'nodes_json' => json_encode($validated['nodes']),
            'total_distance_km' => $validated['total_distance_km'],
            'gpx_data' => $validated['gpx_data'] ?? null,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Fietsroute succesvol bewaard',
            'slug' => $route->slug,
            'url' => route('fietsroute.show', $route->slug)
        ]);
    }

    /**
     * Toon of deel een specifieke bewaarde route
     */
    public function show($slug)
    {
        $route = Fietsroute::where('slug', $slug)->firstOrFail();
        return view('fietsroute', ['savedRoute' => $route]);
    }

    /**
     * Download het GPX-bestand direct voor GPS / Garmin / Wahoo
     */
    public function downloadGpx($slug)
    {
        $route = Fietsroute::where('slug', $slug)->firstOrFail();
        
        return response($route->gpx_data, 200, [
            'Content-Type' => 'application/gpx+xml',
            'Content-Disposition' => 'attachment; filename="' . Str::slug($route->name) . '.gpx"',
        ]);
    }
}
`,

    // Laravel routes/web.php
    laravelRoutes: `<?php

use Illuminate\\Support\\Facades\\Route;
use App\\Http\\Controllers\\FietsrouteController;

// Hoofdpagina van de fietsrouteplanner
Route::get('/', [FietsrouteController::class, 'index'])->name('fietsroute.index');
Route::get('/route/{slug}', [FietsrouteController::class, 'show'])->name('fietsroute.show');
Route::get('/route/{slug}/gpx', [FietsrouteController::class, 'downloadGpx'])->name('fietsroute.gpx');

// API endpoints voor opslaan en laden
Route::prefix('api')->group(function () {
    Route::post('/routes', [FietsrouteController::class, 'store']);
});
`,

    // Laravel Migration
    laravelMigration: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fietsroutes', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->json('nodes_json');
            $table->decimal('total_distance_km', 6, 2);
            $table->longText('gpx_data')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fietsroutes');
    }
};
`,

    // Pure PHP standalone api.php for Antagonist without Laravel
    purePhpApi: `<?php
/**
 * Standalone PHP API voor Antagonist shared hosting (zonder Node.js)
 * Plaats dit bestand als 'api.php' in je public_html/
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Antagonist MySQL configuratie (maak database aan via DirectAdmin)
$dbHost = 'localhost';
$dbName = 'jouwgebruikersnaam_fietsroute';
$dbUser = 'jouwgebruikersnaam_dbuser';
$dbPass = 'jouw_geheim_wachtwoord';

try {
    $pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database connectie mislukt']);
    exit;
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'save_route') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['name']) || empty($input['nodes'])) {
        echo json_encode(['status' => 'error', 'message' => 'Naam en knooppunten zijn verplicht']);
        exit;
    }

    $slug = substr(preg_replace('/[^a-z0-9]/', '-', strtolower($input['name'])), 0, 40) . '-' . bin2hex(random_bytes(3));
    
    $stmt = $pdo->prepare("INSERT INTO routes (slug, name, nodes_json, distance_km, gpx_data, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
        $slug,
        $input['name'],
        json_encode($input['nodes']),
        $input['total_distance_km'] ?? 0,
        $input['gpx_data'] ?? null
    ]);

    echo json_encode([
        'status' => 'success',
        'slug' => $slug,
        'message' => 'Route opgeslagen op Antagonist server'
    ]);
    exit;
}

echo json_encode(['status' => 'ok', 'app' => 'Fietsroute NL & BE Backend']);
`,

    // Antagonist .htaccess
    htaccess: `# Antagonist Apache/DirectAdmin configuratie voor Fietsroute Planner
# Ondersteunt HTTPS geforceerd, React Single Page App routing en browser caching

RewriteEngine On

# 1. Forceer HTTPS (veilige verbinding)
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# 2. Gzip compressie voor razendsnelle laadtijden van kaarten & scripts
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript application/json
</IfModule>

# 3. Browser caching voor OpenStreetMap icons en tiles
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/jpeg "access plus 1 month"
  ExpiresByType text/css "access plus 1 week"
  ExpiresByType application/javascript "access plus 1 week"
</IfModule>

# 4. SPA URL Fallback (zodat /route/123 direct laadt zonder 404)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
`,

    // GitHub Actions Workflow to Antagonist FTP
    githubActions: `# .github/workflows/deploy-antagonist.yml
# Bouwt de webapplicatie in GitHub en uploadt automatisch naar Antagonist via FTP!
# Je hebt dus NOOIT Node.js nodig op je Antagonist webserver.

name: Deploy naar Antagonist Hosting

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Haal code op uit repository
        uses: actions/checkout@v4

      - name: Stel Node.js in (draait gratis in GitHub Cloud)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Installeer dependencies en bouw static assets
        run: |
          npm ci
          npm run build

      - name: Upload dist/ naar Antagonist public_html via FTPS
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: \${{ secrets.ANTAGONIST_FTP_SERVER }} # bijv. s123.antagonist.nl
          username: \${{ secrets.ANTAGONIST_FTP_USER }}
          password: \${{ secrets.ANTAGONIST_FTP_PASSWORD }}
          local-dir: ./dist/
          server-dir: ./public_html/fietsroute/
`
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              PHP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                  Antagonist.nl &amp; Laravel Handleiding
                </h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Geen Node.js nodig
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Gemaakt voor <strong>https://github.com/MGeurts/fietsroute</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-4 pt-2 gap-1 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-emerald-600" />
            <span>Overzicht &amp; Antagonist</span>
          </button>

          <button
            onClick={() => setActiveTab('herd')}
            className={`px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'herd'
                ? 'bg-white text-slate-900 border-t-2 border-red-500 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-red-500" />
            <span>Laravel Herd (Lokaal)</span>
          </button>

          <button
            onClick={() => setActiveTab('laravel')}
            className={`px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'laravel'
                ? 'bg-white text-slate-900 border-t-2 border-red-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-red-600" />
            <span>Laravel Integratie</span>
          </button>

          <button
            onClick={() => setActiveTab('php_simple')}
            className={`px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'php_simple'
                ? 'bg-white text-slate-900 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>Eenvoudig PHP (DirectAdmin)</span>
          </button>

          <button
            onClick={() => setActiveTab('htaccess')}
            className={`px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'htaccess'
                ? 'bg-white text-slate-900 border-t-2 border-amber-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>.htaccess (Antagonist)</span>
          </button>

          <button
            onClick={() => setActiveTab('github_actions')}
            className={`px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'github_actions'
                ? 'bg-white text-slate-900 border-t-2 border-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-slate-800" />
            <span>GitHub Auto-Deploy</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-slate-700 leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Perfect geschikt voor Antagonist webhosting (zonder Node.js)
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    Antagonist shared hosting werkt met standaard <strong>Apache + PHP 8.x + MySQL/MariaDB</strong> via DirectAdmin/cPanel. Omdat een webapplicatie van dit type in productie compileert naar pure <strong>HTML, CSS en JavaScript bestanden (in de <code>dist/</code> map)</strong>, heeft je Antagonist server zélf <strong>geen Node.js runtime daemon</strong> nodig!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Optie A: Direct in Laravel (Blade + Controller)
                  </span>
                  <p className="text-slate-600 text-[11px]">
                    Koppel de planner direct aan je Laravel controller en bewaar gemaakte routes in de MySQL database van Antagonist. Je kunt routes delen met vrienden via <code>/route/mijn-route</code>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Optie B: Automatische GitHub Actions Deploy
                  </span>
                  <p className="text-slate-600 text-[11px]">
                    Bouw de code automatisch in de cloud bij elke <code>git push</code> naar <code>MGeurts/fietsroute</code> en laat GitHub Actions het resultaat direct via veilige FTPS uploaden naar je <code>public_html/</code> op Antagonist.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-2">
                <div className="font-bold">Hoe zet je dit nu op in je repository?</div>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Clone je repository: <code>git clone https://github.com/MGeurts/fietsroute.git</code></li>
                  <li>Voeg de broncode toe of download de bestanden via de onderstaande tabbladen.</li>
                  <li>Kies het tabblad <strong>Laravel Herd</strong>, <strong>Laravel Integratie</strong> of <strong>Eenvoudig PHP</strong> om de bestanden in te zien en te kopiëren.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'herd' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center font-bold text-xs">H</div>
                  <h3 className="text-sm font-bold text-slate-900">Laravel Herd gebruiken zónder <code>npm run dev</code></h3>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Krijg je in je browser de rode melding <strong>"404 Site not found"</strong> op <code>https://fietsroute.test</code>? Dat betekent enkel dat Herd de map nog niet aan het domein heeft gekoppeld. Volg deze twee stappen:
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-900">Stap 1: Koppel de map in Laravel Herd</div>
                <p className="text-slate-600 text-[11px]">
                  Open PowerShell of Windows Terminal in de projectmap en voer uit:
                </p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                  herd link fietsroute
                </pre>
                <p className="text-slate-500 text-[11px]">
                  <em>(Of open Herd Settings &gt; Sites &gt; klik op "+" en selecteer de map <code>fietsroute</code>).</em>
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-900">Stap 2: Bouw het pakket éénmalig</div>
                <p className="text-slate-600 text-[11px]">
                  Omdat de browser kant-en-klare HTML, CSS en JS nodig heeft, bouw je het project één keer:
                </p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                  npm run build
                </pre>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 text-[11px] space-y-1">
                <div className="font-bold">Klaar! Geen achtergrondproces nodig</div>
                <p>
                  Je kunt je terminal nu sluiten. Herd serveert via het meegeleverde <code>LocalValetDriver.php</code> en <code>index.php</code> automatisch de gecompileerde app op <strong>https://fietsroute.test</strong>!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'laravel' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900">
                    1. Laravel Controller (<code>app/Http/Controllers/FietsrouteController.php</code>)
                  </span>
                  <button
                    onClick={() => copyCode(codeSnippets.laravelController, 'ctrl')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'ctrl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'ctrl' ? 'Gekopieerd' : 'Kopieer'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56">
                  {codeSnippets.laravelController}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900">
                    2. Web Routes (<code>routes/web.php</code>)
                  </span>
                  <button
                    onClick={() => copyCode(codeSnippets.laravelRoutes, 'routes')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'routes' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'routes' ? 'Gekopieerd' : 'Kopieer'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                  {codeSnippets.laravelRoutes}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900">
                    3. Database Migratie (<code>database/migrations/...create_fietsroutes_table.php</code>)
                  </span>
                  <button
                    onClick={() => copyCode(codeSnippets.laravelMigration, 'mig')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'mig' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'mig' ? 'Gekopieerd' : 'Kopieer'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                  {codeSnippets.laravelMigration}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'php_simple' && (
            <div className="space-y-3">
              <p>
                Wil je géén heel Laravel framework installeren maar gewoon een snelle, schone PHP API die direct op Antagonist in je <code>public_html</code> draait? Gebruik onderstaand bestand als <code>api.php</code>:
              </p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-900">
                  Eenvoudig PHP Backend (<code>api.php</code> voor Antagonist)
                </span>
                <button
                  onClick={() => copyCode(codeSnippets.purePhpApi, 'php_simple')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                >
                  {copiedKey === 'php_simple' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'php_simple' ? 'Gekopieerd' : 'Kopieer code'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-72">
                {codeSnippets.purePhpApi}
              </pre>
            </div>
          )}

          {activeTab === 'htaccess' && (
            <div className="space-y-3">
              <p>
                Plaats dit <code>.htaccess</code> bestand in de hoofdmap van je Antagonist webruimte (<code>public_html/</code>). Dit zorgt voor automatische HTTPS, gzip compressie en nette URL routering:
              </p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-900">
                  Antagonist Apache configuratie (<code>.htaccess</code>)
                </span>
                <button
                  onClick={() => copyCode(codeSnippets.htaccess, 'htaccess')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                >
                  {copiedKey === 'htaccess' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'htaccess' ? 'Gekopieerd' : 'Kopieer .htaccess'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-amber-300 rounded-xl font-mono text-[11px] overflow-x-auto">
                {codeSnippets.htaccess}
              </pre>
            </div>
          )}

          {activeTab === 'github_actions' && (
            <div className="space-y-3">
              <p>
                Met deze GitHub Actions workflow bouw je de applicatie automatisch in de cloud en upload je direct naar je Antagonist webserver via FTPS. <strong>Geen Node.js nodig op Antagonist!</strong>
              </p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-900">
                  GitHub Actions Workflow (<code>.github/workflows/deploy-antagonist.yml</code>)
                </span>
                <button
                  onClick={() => copyCode(codeSnippets.githubActions, 'gha')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                >
                  {copiedKey === 'gha' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'gha' ? 'Gekopieerd' : 'Kopieer workflow'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-cyan-300 rounded-xl font-mono text-[11px] overflow-x-auto max-h-72">
                {codeSnippets.githubActions}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <a
            href="https://github.com/MGeurts/fietsroute"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-emerald-700 font-semibold"
          >
            <span>Open MGeurts/fietsroute op GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md shadow-xs transition cursor-pointer"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
