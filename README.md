# 🚴 Fietsroute Planner NL & BE

[![GitHub Repository](https://img.shields.io/badge/GitHub-MGeurts%2Ffietsroute-emerald?logo=github)](https://github.com/MGeurts/fietsroute)
[![OpenStreetMap](https://img.shields.io/badge/Map%20Data-OpenStreetMap-7EBC6F?logo=openstreetmap)](https://www.openstreetmap.org)
[![Knooppunten](https://img.shields.io/badge/Netwerk-Fietsknooppunten%20NL%20%26%20BE-059669)](https://www.fietsnet.be)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PHP Hosting Ready](https://img.shields.io/badge/Hosting-Antagonist%20%2F%20PHP%20Ready-red?logo=php)](https://www.antagonist.nl)

An open-source interactive cycle route planner for **the Netherlands and Belgium**, powered by **OpenStreetMap (OSM)** and the official **Fietsknooppuntennetwerk** (Cycle Junction Network). 

This application allows cyclists to compose routes by clicking numbered junction nodes, inspect elevation profiles and leg distances, import/export GPX tracks, generate automatic round-trip loops, print handlebar reference strips (*stuurbordstrookje*), and deploy seamlessly to both modern cloud environments and traditional **PHP/Apache webservers** (such as [Antagonist.nl](https://www.antagonist.nl)) without requiring a server-side Node.js daemon.

---

## 📑 Inhoudsopgave / Table of Contents

1. [Features & Capabilities](#-features--capabilities)
2. [Application Architecture](#-application-architecture)
3. [System Requirements](#-system-requirements)
4. [Local Development Installation](#-local-development-installation)
5. [Online & Cloud Development Server](#-online--cloud-development-server)
6. [Deployment to PHP Hosting (Antagonist.nl / Shared Hosting)](#-deployment-to-php-hosting-antagonistnl--shared-hosting)
   - [Method A: GitHub Actions Automated FTPS Deploy (Recommended)](#method-a-github-actions-automated-ftps-deploy-recommended)
   - [Method B: Manual Static Build Upload](#method-b-manual-static-build-upload)
   - [Method C: Full Laravel Integration](#method-c-full-laravel-integration)
   - [Method D: Standalone PHP API (`api.php`)](#method-d-standalone-php-api-apiphp)
7. [Environment Variables & Configuration](#-environment-variables--configuration)
8. [Available Scripts](#-available-scripts)
9. [Troubleshooting & FAQ](#-troubleshooting--faq)
10. [License & Credits](#-license--credits)

---

## 🌟 Features & Capabilities

- **Verified junction planning**: A leg is rendered only when a build-time verified RCN corridor exists for those exact endpoints. Missing data is shown as “geen route”, never as a general bicycle route or a synthetic line.
- **Dynamic OSM Overpass Discovery**: Fetch live knooppunt nodes across the Netherlands and Belgium directly from OpenStreetMap with a single click ("*Scan knooppunten in dit kaartvenster*").
- **Multiple High-Quality Map Layers**:
  - OpenStreetMap Standard
  - OpenCycleMap / CyclOSM (specialized cycling infrastructure & gradients)
  - CartoDB Positron (clean, high-contrast light map)
  - Topographic & Elevation Contours
  - Satellite Aerial Imagery (Esri World Imagery)
  - Waymarked Trails Cycling Overlay (shows regional LF and numbered network routes)
- **GPX Export & Import**:
  - Download standards-compliant `.gpx` files containing track points and numbered route waypoints.
  - Import existing `.gpx` routes from Garmin, Wahoo, Strava, Komoot, Fietsnet, or RouteYou.
- **Printable Handlebar Strip (*Fietsknooppunten-strookje*)**:
  - Generates a classic compact cue strip with node numbers and intermediate distances formatted to tape onto a handlebar stem or bike bag.
  - One-click printer styling (`@media print`) and clipboard copy.
- **Automatic Round-Trip Generator (*Rondrit Generator*)**:
  - Automatically calculates smooth, circular loop routes returning to your departure point based on a target distance (e.g. 20 km, 35 km, 60 km, 80 km).
- **Elevation Profiles**:
  - Visual SVG elevation graph displaying min/max terrain elevation and total climbing meters, sampled live from Copernicus DEM via Open-Meteo (no server-side Node.js required).
- **Bicycle Profiles**:
  - Choose between *Stadsfiets* (16 km/h), *E-Bike* (22 km/h), *Toer- / Gravelbike* (24 km/h), or *Racefiets* (28 km/h) for accurate travel time calculation.
- **PHP & Laravel Ready**:
  - Specially tailored for deployment to Dutch shared webhosting providers (like Antagonist.nl) where Node.js is unavailable on the server runtime.

---

## 🏗 Application Architecture

The application is engineered as a modern, high-performance client-side Single Page Application (SPA) with optional server-side PHP/Laravel connectors:

```
├── index.html                    # HTML5 entry point & metadata
├── metadata.json                 # Project configuration & permissions
├── package.json                  # Dependencies & execution scripts
├── vite.config.ts                # Vite 6 bundler configuration
├── src/
│   ├── main.tsx                  # React DOM mount point
│   ├── App.tsx                   # Main layout controller & state management
│   ├── index.css                 # Tailwind CSS 4 setup & Leaflet customizations
│   ├── types.ts                  # TypeScript interfaces & domain types
│   ├── components/
│   │   ├── MapPlanner.tsx        # Leaflet map container & Overpass queries
│   │   ├── RoutePanel.tsx        # Route summary, node queue, and metrics
│   │   ├── ElevationProfile.tsx  # SVG elevation contour visualizer
│   │   ├── StrookjePrintModal.tsx# Printable handlebar strip dialog
│   │   ├── RoundTripModal.tsx    # Automatic circular route generator
│   │   ├── GpxImportModal.tsx    # Drag-and-drop GPX file importer
│   │   └── LaravelAntagonistModal.tsx # PHP, Laravel & Antagonist guides
│   ├── services/
│   │   ├── routingService.ts     # Haversine distance, GPX parsing & generation
│   │   └── overpassService.ts    # OpenStreetMap Overpass API knooppunt scanner
│   └── data/
│       └── initialNodes.ts       # Verified junction node dataset (Limburg/BE/NL)
```

---

## 💻 System Requirements

### For Local Development:
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **Package Manager**: `npm` (v9+), `pnpm`, `yarn`, or `bun`
- Modern web browser with WebGL/Canvas support (Chrome, Firefox, Safari, Edge)

### For Online Production Server (Antagonist.nl / Shared Hosting):
- **Web Server**: Apache 2.4+ (with `mod_rewrite` enabled)
- **PHP**: PHP 8.0, 8.1, 8.2, or 8.3
- **Database (Optional for saving routes)**: MySQL 5.7+ / MariaDB 10.3+
- **Node.js on Server**: ❌ **NOT REQUIRED**. The app compiles into pure static HTML/JS/CSS files.

---

## 🚀 Local Development Installation

Follow these steps to run the application on your local machine:

### 1. Clone the Repository

```bash
git clone https://github.com/MGeurts/fietsroute.git
cd fietsroute
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Or using pnpm / yarn / bun:
```bash
pnpm install
# or
yarn install
# or
bun install
```

### Build or update the official network dataset

Run this on a development machine or in CI, never on Antagonist hosting. It validates `rcn` route relations and writes `public/data/benelux_network.json`. An explicit OSM node-to-node relation remains in the graph even if its route geometry cannot safely be assembled; the planner obtains that individual line from a clearly marked live bicycle-router fallback. Every examined relation is documented in `public/data/benelux_network_validation.json` as `verified-geometry`, `declared-topology`, or `rejected`, including the reason for the latter two. The importer downloads the public [Geofabrik Belgium](https://download.geofabrik.de/europe/belgium.html) and [Netherlands](https://download.geofabrik.de/europe/netherlands.html) OpenStreetMap extracts and processes them on disk with `osmium-tool`; it never asks Overpass for a country-wide JSON response. Install `osmium-tool` first (`sudo apt-get install osmium-tool` on Ubuntu). The download is roughly 2 GB and can take a while.

```bash
npm run build:network
```

If you do not want to download the extracts locally, use **Actions → Build official cycle-network dataset → Run workflow**. The manual workflow installs Osmium on a GitHub-hosted runner and commits the network dataset and validation report only when it successfully completes. To reuse locally downloaded extracts, set `NETWORK_PBF_DIR` to the folder containing `belgium-latest.osm.pbf` and `netherlands-latest.osm.pbf`.

After that build, the **Analyse** button in the planner opens the local validation report. It shows OSM relation IDs, resolved endpoints, geometry status, and reasons for topology-only or unresolved relations. The default view is a 25 km radius around knooppunt 29; selecting a node first uses that node as the centre.

### 3. Start the Development Server

```bash
npm run dev
```

The Vite dev server will start instantly and display the local URL:
```text
  VITE v6.2.3  ready in 210 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://0.0.0.0:3000/
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Code Quality Checks & Linter

```bash
# Type-check TypeScript codebase
npm run lint

# Clean build artifacts
npm run clean
```

---

## ⚡ Using Laravel Herd as Local Server (No `npm run dev` needed)

**Yes! You can use Laravel Herd (`https://fietsroute.test`) directly as your local development server without keeping `npm run dev` running.**

### Why did you see "404 Site not found" in Herd?
When Herd displays its red **"404 - Site not found"** error screen, it means Herd does not yet know which folder corresponds to the domain `fietsroute.test`.

### Step 1: Link your project folder in Laravel Herd

Choose **one** of these two quick ways:

- **Via Terminal / PowerShell (Fastest)**:
  Open your terminal inside the `fietsroute` folder and run:
  ```powershell
  cd C:\pad\naar\fietsroute
  herd link fietsroute
  ```
  *(Or simply `herd link` if the folder itself is already named `fietsroute`)*.

- **Via the Herd Windows App GUI**:
  1. Click the **Laravel Herd** icon in your Windows system tray (bottom right near the clock).
  2. Open **Settings** > **Sites**.
  3. Click **"+"** or **"Link Path"** and select your `fietsroute` project folder.
  4. Ensure the site name is set to `fietsroute` so it answers to `https://fietsroute.test`.

---

### Step 2: Build the static bundle once

Because web browsers cannot execute TypeScript (`.tsx`) files natively without compilation, build the production assets **once**:

```powershell
npm run build
```

This generates an optimized, self-contained `dist/` directory.

### Step 3: Open `https://fietsroute.test`!

You're all set! 
- **No background Node.js process required**: You can close your terminal and do **not** need to run `npm run dev`.
- Herd's built-in Nginx webserver uses the included `index.php` and `public/index.php` to immediately serve the compiled planner directly at **`https://fietsroute.test`** with automatic local SSL certificates.
- If you ever change the TypeScript or React source code, just run `npm run build` again to refresh the build.

---

## 🌐 Online & Cloud Development Server

If you want to host an online development instance (e.g. on a VPS, Google Cloud Run, Render, DigitalOcean, or Docker container):

### Running with Docker

Create a `Dockerfile` in the root directory:

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 3000;
    server_name localhost;
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

Build and run the container:
```bash
docker build -t fietsroute-planner .
docker run -d -p 3000:3000 --name fietsroute fietsroute-planner
```

Access the app at `http://<your-server-ip>:3000`.

---

## 📦 Deployment to PHP Hosting (Antagonist.nl / Shared Hosting)

Antagonist.nl provides reliable cPanel / DirectAdmin shared webhosting running **Apache and PHP**, but does not offer persistent Node.js application daemons. Because this route planner compiles into static client-side web bundles, it works smoothly on Antagonist.

### Method A: GitHub Actions Automated FTPS Deploy (Recommended)

You can configure GitHub to automatically build the application and deploy it via FTPS to your Antagonist `public_html/` folder whenever you push to `main`.

1. In your GitHub repository (`https://github.com/MGeurts/fietsroute`), go to **Settings > Secrets and variables > Actions**.
2. Add three repository secrets:
   - `ANTAGONIST_FTP_SERVER`: Your Antagonist server address (e.g. `s123.antagonist.nl`)
   - `ANTAGONIST_FTP_USER`: Your FTP / DirectAdmin username
   - `ANTAGONIST_FTP_PASSWORD`: Your FTP password
3. Create the file `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy Fietsroute to Antagonist

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js (runs in GitHub Cloud)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies & build production bundle
        run: |
          npm ci
          npm run build

      - name: Deploy dist/ via secure FTPS to Antagonist
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.ANTAGONIST_FTP_SERVER }}
          username: ${{ secrets.ANTAGONIST_FTP_USER }}
          password: ${{ secrets.ANTAGONIST_FTP_PASSWORD }}
          local-dir: ./dist/
          server-dir: ./public_html/fietsroute/
          protocol: ftps
```

Whenever you push changes (`git push origin main`), GitHub will build the application in the cloud for free and upload the resulting files to Antagonist in less than 60 seconds.

---

### Method B: Manual Static Build Upload

If you prefer deploying manually:

1. Build the production files on your local machine:
   ```bash
   npm run build
   ```
   This generates an optimized, self-contained `dist/` folder.
2. Log into Antagonist **DirectAdmin** or connect via FileZilla / WinSCP using SFTP/FTPS.
3. Navigate to your web directory, e.g.:
   ```text
   /domains/yourdomain.nl/public_html/fietsroute/
   ```
4. Upload all files from your local `dist/` directory into that folder.
5. Create an `.htaccess` file in that folder (see below) to ensure single-page URL routing and browser caching.

---

### Method C: Full Laravel Integration

If you want to integrate the route planner into an existing or new **Laravel** application on Antagonist:

#### 1. Controller (`app/Http/Controllers/FietsrouteController.php`)
```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Fietsroute;
use Illuminate\Support\Str;

class FietsrouteController extends Controller
{
    public function index()
    {
        return view('fietsroute');
    }

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
        ]);

        return response()->json([
            'success' => true,
            'slug' => $route->slug,
            'share_url' => url('/route/' . $route->slug)
        ]);
    }

    public function show($slug)
    {
        $route = Fietsroute::where('slug', $slug)->firstOrFail();
        return response()->json($route);
    }
}
```

#### 2. Routes (`routes/web.php`)
```php
use App\Http\Controllers\FietsrouteController;

Route::get('/fietsroute', [FietsrouteController::class, 'index'])->name('fietsroute.index');
Route::post('/api/routes', [FietsrouteController::class, 'store'])->name('fietsroute.store');
Route::get('/api/routes/{slug}', [FietsrouteController::class, 'show'])->name('fietsroute.show');
```

#### 3. Database Migration (`database/migrations/..._create_fietsroutes_table.php`)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('fietsroutes', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->json('nodes_json');
            $table->decimal('total_distance_km', 6, 2);
            $table->longText('gpx_data')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fietsroutes');
    }
};
```

---

### Method D: Standalone PHP API (`api.php`)

If you do not wish to use the full Laravel framework and only want a lightweight PHP backend to store and retrieve routes in MySQL on Antagonist:

```php
<?php
// Place in public_html/fietsroute/api.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

$dbHost = 'localhost';
$dbName = 'jouwgebruiker_fietsroutes';
$dbUser = 'jouwgebruiker_dbuser';
$dbPass = 'JOUW_ANTAGONIST_DB_WACHTWOORD';

try {
    $pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Databaseverbinding mislukt']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['name']) || empty($input['nodes'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Ongeldige payload']);
        exit;
    }

    $slug = substr(preg_replace('/[^a-z0-9]+/i', '-', strtolower($input['name'])), 0, 40) . '-' . bin2hex(random_bytes(3));
    
    $stmt = $pdo->prepare("INSERT INTO fietsroutes (slug, name, nodes_json, total_distance_km, created_at) VALUES (?, ?, ?, ?, NOW())");
    $stmt->execute([
        $slug,
        $input['name'],
        json_encode($input['nodes']),
        $input['total_distance_km'] ?? 0
    ]);

    echo json_encode(['success' => true, 'slug' => $slug]);
    exit;
}

if ($method === 'GET' && isset($_GET['slug'])) {
    $stmt = $pdo->prepare("SELECT * FROM fietsroutes WHERE slug = ?");
    $stmt->execute([$_GET['slug']]);
    $route = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$route) {
        http_response_code(404);
        echo json_encode(['error' => 'Route niet gevonden']);
        exit;
    }
    
    $route['nodes'] = json_decode($route['nodes_json'], true);
    unset($route['nodes_json']);
    echo json_encode($route);
    exit;
}
```

---

### 🛡 Apache Configuration (`.htaccess`)

Place this `.htaccess` file inside your `public_html/` folder on Antagonist:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Force secure HTTPS
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

  # Don't rewrite real existing files or directories
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Route all other URLs to index.html for Single Page Application routing
  RewriteRule ^ index.html [L]
</IfModule>

# Enable GZIP compression for fast loading
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Browser cache headers for static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/svg+xml "access plus 1 month"
  ExpiresByType text/css "access plus 1 week"
  ExpiresByType application/javascript "access plus 1 week"
</IfModule>
```

---

## ⚙️ Environment Variables & Configuration

The application is fully client-side and functional out-of-the-box without mandatory environment variables. For optional integrations or custom APIs:

| Variable | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `PORT` | Local dev server binding port | No | `3000` |
| `VITE_API_URL` | Optional custom backend route storage endpoint | No | *Empty* |

Example `.env` file for local development:
```env
# Optional configuration
PORT=3000
```

---

## 📜 Available Scripts

In the project root, you can execute the following `npm` commands:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts Vite development server at `http://0.0.0.0:3000` with instant reloading |
| `npm run build` | Compiles optimized production bundle into `dist/` ready for web deployment |
| `npm run preview` | Locally serves the compiled production build from `dist/` to verify behavior |
| `npm run lint` | Runs TypeScript compiler (`tsc --noEmit`) to validate type safety |
| `npm run clean` | Removes `dist/` and temporary build output files |

---

## ❓ Troubleshooting & FAQ

#### 1. Why don't junction nodes appear on the map?
Zoom in to level 11 or closer. Click the **"Scan knooppunten in dit venster"** button in the top right floating controls. This triggers an Overpass API query fetching official OSM `network:type=node_network` and `rcn_ref` nodes within your current viewport.

#### 2. Does this require Node.js on my webhosting (Antagonist)?
**No.** When deploying to Antagonist, you only upload the pre-compiled files generated by `npm run build` (or via the GitHub Actions workflow). The files are static HTML, JS, and CSS that Apache and PHP serve directly.

#### 3. Can I import GPX files recorded with Strava or Garmin?
**Yes.** Click **"Importeer GPX"** in the sidebar, then drop your `.gpx` file. The planner parses track points and waypoints, visualizes the route on the map, and extracts distance and elevation details.

#### 4. How do I print the handlebar strip?
Click **"Strookje afdrukken"** in the sidebar. You will see a preview card formatted for bicycle handlebars. Click **"Print strookje"** to print directly (the print stylesheet automatically removes the map, sidebar, and headers, leaving only the strip).

---

## 📄 License & Open-Source Credits

- **License**: Released under the open-source [MIT License](LICENSE).
- **Map Data**: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).
- **Cycling Overlay Data**: [Waymarked Trails](https://cycling.waymarkedtrails.org/) & [OpenCycleMap](https://www.opencyclemap.org/).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Interactive Maps**: [Leaflet.js](https://leafletjs.com/).

Developed for the open-source cycling community at **[https://github.com/MGeurts/fietsroute](https://github.com/MGeurts/fietsroute)**.
