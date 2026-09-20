// ============================================================
// Metro, taught to read the web app's shared layer.
//
// The mobile app does not copy the API client, the workspace client or the
// translations — it bundles the very files the web app uses, out of
// ../web/src. That is the whole point: one client layer, one set of document
// shapes, one Turkish dictionary, and no second copy to drift.
//
// Three settings make it work, and two of them are not optional.
// ============================================================
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const webSrc = path.resolve(projectRoot, '../web/src')

const config = getDefaultConfig(projectRoot)

// Metro refuses to serve a file outside the project root unless it is watched.
// Only web/src — watching the repo root would drag in backend/, .git/ and
// db_backup/, which is slow on Windows and buys nothing.
config.watchFolders = [webSrc]

// Not optional. Without these, a file under web/src resolves `react` by
// walking *up* from its own location and finds web/node_modules — a second
// copy of React in the same bundle, and every hook throws "Invalid hook call"
// with a stack that points nowhere useful. Pin all resolution to this app's
// own node_modules.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]
config.resolver.disableHierarchicalLookup = true

// Browser-only shared code must fail at build time, not ship. ocr.js pulls
// tesseract.js, Web Workers and ~10 MB of WASM that cannot run under Hermes;
// an accidental import should be a bundling error, not a mystery at runtime.
config.resolver.blockList = [
  /web[\\/]src[\\/]lib[\\/]ocr\.js$/,
  /web[\\/]node_modules[\\/].*/,
]

module.exports = config
