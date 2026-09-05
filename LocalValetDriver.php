<?php

/**
 * Laravel Herd / Valet Local Driver for Fietsroute Planner
 * 
 * Allows Laravel Herd to serve this project natively at http(s)://fietsroute.test
 * without requiring `npm run dev` to be running in the background.
 */
class LocalValetDriver extends ValetDriver
{
    /**
     * Determine if the driver serves the request.
     */
    public function serves(string $sitePath, string $siteName, string $uri): bool
    {
        return true;
    }

    /**
     * Determine if the incoming request is for a static file.
     */
    public function isStaticFile(string $sitePath, string $siteName, string $uri): string|false
    {
        // 1. Check in dist/ (production build)
        $distFile = $sitePath . '/dist' . $uri;
        if (file_exists($distFile) && !is_dir($distFile)) {
            return $distFile;
        }

        // 2. Check in public/
        $publicFile = $sitePath . '/public' . $uri;
        if (file_exists($publicFile) && !is_dir($publicFile)) {
            return $publicFile;
        }

        // 3. Check in project root
        $rootFile = $sitePath . $uri;
        if (file_exists($rootFile) && !is_dir($rootFile)) {
            return $rootFile;
        }

        return false;
    }

    /**
     * Get the fully resolved path to the application's front controller.
     */
    public function frontControllerPath(string $sitePath, string $siteName, string $uri): ?string
    {
        // If dist/index.html exists (after npm run build), serve it
        if (file_exists($sitePath . '/dist/index.html')) {
            return $sitePath . '/dist/index.html';
        }

        // Otherwise serve root index.html
        if (file_exists($sitePath . '/index.html')) {
            return $sitePath . '/index.html';
        }

        // Fallback to index.php
        if (file_exists($sitePath . '/index.php')) {
            return $sitePath . '/index.php';
        }

        return null;
    }
}
