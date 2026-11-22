<?php
declare(strict_types=1);

// Serve only the production build when running through Flock/PHP hosting.
$root = realpath(__DIR__ . '/dist');
if ($root === false) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Voer eerst npm install en npm run build uit.');
}
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (str_contains($path, "\0") || str_contains($path, '\\') || in_array('..', explode('/', $path), true)) {
    http_response_code(400);
    exit;
}
$file = realpath($root . ($path === '/' ? '/index.html' : $path));
if ($file === false || !is_file($file) || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    exit;
}
$types = ['html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'json' => 'application/json', 'webmanifest' => 'application/manifest+json', 'svg' => 'image/svg+xml'];
$type = $types[pathinfo($file, PATHINFO_EXTENSION)] ?? null;
if ($type === null) { http_response_code(404); exit; }
header('Content-Type: ' . $type);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');
if (basename($file) === 'sw.js') { header('Service-Worker-Allowed: /'); }
readfile($file);
