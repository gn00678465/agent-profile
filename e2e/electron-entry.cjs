'use strict';
// CJS entry point for Playwright's electron.launch().
// Playwright preloads its own CJS loader.js with -r (which patches app.emit via require('electron')).
// The real app entry is an ES module (.mjs). Using a CJS bridge ensures both this file
// and loader.js share the same CommonJS module cache and the same `app` singleton.
//
// Node.js v22.12+ supports require() of synchronous ES modules, so we use it here
// instead of dynamic import() to avoid a race condition with Playwright's inspector init.
const path = require('path');
const mainPath = path.join(__dirname, '..', 'dist-electron', 'main', 'index.mjs');
require(mainPath);
