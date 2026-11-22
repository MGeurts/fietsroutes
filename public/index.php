<?php
declare(strict_types=1);

// Flock's PHP routing expects index.php even when the document root is a static build.
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if ($path !== '/' && $path !== '/index.php') {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Niet gevonden.');
}
$html = __DIR__ . '/index.html';
if (!is_file($html)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Bouw de app met npm run build en stel de Flock-documentroot in op dist.');
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
readfile($html);
