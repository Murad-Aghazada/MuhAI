/* ============================================================
   The shared layer — the allow-list.

   Every file in this folder is a one-line re-export of a file the *web* app
   owns, under ../../../web/src. The mobile app bundles those files directly
   through Metro's watchFolders (see metro.config.js); nothing is copied, so
   the API client, the document shapes and the Turkish dictionary cannot drift
   between the two clients.

   This barrel exists to make that surface explicit and grep-able, and to give
   a single place to shim one file later without touching any screen.

   Deliberately absent: web/src/lib/ocr.js — browser-only (tesseract.js, Web
   Workers, WASM). Mobile uses the server OCR endpoint instead, and
   metro.config.js blocks that import at build time.
   ============================================================ */
export * from '../../../web/src/lib/client.js'
