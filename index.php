<?php
/**
 * Fietsroute Planner - PHP Entrypoint for Laravel Herd & PHP Webservers
 * 
 * This file serves the compiled application (from dist/index.html) or root index.html
 * when accessed via Laravel Herd (http://fietsroute.test) or Apache/Nginx.
 */

// If a built production version exists in dist/, serve it
if (file_exists(__DIR__ . '/dist/index.html')) {
    $requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $distPath = __DIR__ . '/dist' . $requestUri;

    // If requesting a specific static asset that exists in dist/
    if ($requestUri !== '/' && file_exists($distPath) && !is_dir($distPath)) {
        $ext = pathinfo($distPath, PATHINFO_EXTENSION);
        $mimeTypes = [
            'js' => 'application/javascript',
            'css' => 'text/css',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'json' => 'application/json',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
        ];

        if (isset($mimeTypes[$ext])) {
            header('Content-Type: ' . $mimeTypes[$ext]);
        }
        readfile($distPath);
        exit;
    }

    // Serve dist/index.html
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/dist/index.html');
    exit;
}

// Fallback: Notice if dist/ has not been built yet
?>
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Fietsroute Planner - Laravel Herd Setup</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; line-height: 1.6; }
    .card { max-width: 640px; margin: 40px auto; background: #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155; }
    h1 { color: #10b981; font-size: 22px; margin-top: 0; }
    code { background: #0f172a; padding: 3px 8px; border-radius: 6px; font-family: monospace; color: #38bdf8; }
    .btn { display: inline-block; background: #059669; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚴 Fietsroute Planner - Laravel Herd verbinding geslaagd!</h1>
    <p>Laravel Herd heeft de map <code>fietsroute</code> correct herkend via <code>fietsroute.test</code>.</p>
    <p>Om de applicatie zonder <code>npm run dev</code> te gebruiken, moet de frontend éénmalig worden gecompileerd naar de <code>dist/</code> map:</p>
    <pre style="background: #0f172a; padding: 14px; border-radius: 8px; overflow-x: auto; color: #4ade80;">npm run build</pre>
    <p style="color: #94a3b8; font-size: 13px;">Zodra <code>npm run build</code> is uitgevoerd, zal Laravel Herd direct de volledige routeplanner tonen op <code>https://fietsroute.test</code>!</p>
  </div>
</body>
</html>
