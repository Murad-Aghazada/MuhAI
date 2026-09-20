/* ============================================================
   Guard the shared layer.

   web/src/lib/* is bundled by BOTH clients now — Vite for the browser, Metro
   for the phone. A browser-only reflex added there breaks the mobile app and
   no web test notices, because no web test can: the code runs perfectly in a
   browser. That is the whole failure mode this script exists to catch.

   Run it before committing a change to a shared file:
       npm --prefix mobile run check:shared

   Two severities:
     - `import.meta`  is fatal. Metro cannot *parse* it, so the entire mobile
       bundle dies with a syntax error pointing at a web file.
     - browser globals are fatal unless feature-detected (`typeof x !== ...`),
       because they throw at runtime on a device, inside whatever screen
       happens to touch them first.

   Comments are stripped before matching, so prose about `localStorage` is
   fine. Real exceptions are listed in ALLOWED and have to justify themselves.
   ============================================================ */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const sharedDir = path.resolve(here, '../src/shared')
const webSrc = path.resolve(here, '../../web/src')

// file -> why a browser global is acceptable there
const ALLOWED = {
  'lib/client.js':
    'the localStorage adapter is feature-detected and only selected when it exists',
}

const BROWSER_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator)\s*\./g
const FEATURE_DETECT = /typeof\s+(window|document|localStorage|sessionStorage|navigator)\b/

/** Drop // and block comments and string literals so prose never matches. */
function strip(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

/** Every web file the shared barrel actually re-exports. */
function sharedFiles() {
  const out = []
  for (const entry of fs.readdirSync(sharedDir)) {
    const src = fs.readFileSync(path.join(sharedDir, entry), 'utf8')
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      const resolved = path.resolve(sharedDir, m[1])
      if (resolved.startsWith(webSrc)) out.push(resolved)
    }
  }
  return [...new Set(out)]
}

const problems = []
for (const file of sharedFiles()) {
  if (!fs.existsSync(file)) {
    problems.push({ file, line: 0, kind: 'missing', text: 'barrel points at a file that does not exist' })
    continue
  }
  const rel = path.relative(webSrc, file).replace(/\\/g, '/')
  const code = strip(fs.readFileSync(file, 'utf8'))

  code.split('\n').forEach((line, i) => {
    if (line.includes('import.meta')) {
      problems.push({ file: rel, line: i + 1, kind: 'import.meta', text: line.trim() })
    }
    const hits = [...line.matchAll(BROWSER_GLOBALS)]
    if (hits.length && !FEATURE_DETECT.test(line) && !ALLOWED[rel]) {
      problems.push({
        file: rel,
        line: i + 1,
        kind: hits[0][1],
        text: line.trim().slice(0, 100),
      })
    }
  })
}

const files = sharedFiles().length
if (problems.length === 0) {
  console.log(`shared layer OK — ${files} files from web/src are safe for Metro`)
  for (const [f, why] of Object.entries(ALLOWED)) console.log(`  allowed: ${f} — ${why}`)
  process.exit(0)
}

console.error(`shared layer FAILED — ${problems.length} problem(s):\n`)
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}  [${p.kind}]  ${p.text}`)
}
console.error(
  '\nThese files are bundled by Metro for the Expo app (see N20 in CLAUDE.md).',
)
console.error('Move platform-specific code to web/src/main.jsx or the page layer.')
process.exit(1)
