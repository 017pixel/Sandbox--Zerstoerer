/**
 * Diff-Klassifikation und Testzuordnung für Sandbox-Zerstörer.
 *
 * Wird von `release:scope` und `test:changed` gemeinsam genutzt, damit
 * Klassifikation und Testauswahl nie auseinanderlaufen.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SPECS = {
  smoke: 'tests/smoke.spec.mjs',
  core: 'tests/core.spec.mjs',
  offline: 'tests/offline.spec.mjs',
  landing: 'tests/landing.spec.mjs',
};
const SPEC_ORDER = [SPECS.smoke, SPECS.core, SPECS.offline, SPECS.landing];
const ALL_SPECS = readdirSync(join(root, 'tests'))
  .filter((file) => file.endsWith('.spec.mjs'))
  .map((file) => `tests/${file}`);

const DATA_FILES = new Set(['sb-storage.js', 'sb-chunk.js', 'sw.js']);
const ENGINE_FILES = new Set([
  'sb-physics.js',
  'sb-renderer.js',
  'sb-world.js',
  'sb-main.js',
  'sb-utils.js',
  'sb-audio.js',
]);
const PACKAGE_DEPENDENCY_KEYS = [
  'dependencies',
  'devDependencies',
  'engines',
  'overrides',
  'peerDependencies',
  'optionalDependencies',
  'packageManager',
];

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return '';
  }
}

export function refExists(ref) {
  if (!ref) return false;
  try {
    execFileSync('git', ['rev-parse', '--verify', ref], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

export function collectChangedFiles({ base } = {}) {
  const files = new Set();
  if (base) {
    const output = tryGit(['diff', '--name-only', `${base}...HEAD`]);
    for (const file of output.split('\n').filter(Boolean)) files.add(file);
  }

  const commands = [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  for (const args of commands) {
    const output = tryGit(args);
    for (const file of output.split('\n').filter(Boolean)) files.add(file);
  }
  return [...files].sort();
}

function changedLines(file, { base } = {}) {
  const parts = [];
  if (base) {
    parts.push(tryGit(['diff', '--unified=0', `${base}...HEAD`, '--', file]));
  }
  parts.push(tryGit(['diff', '--unified=0', 'HEAD', '--', file]));

  if (parts.every((part) => !part)) {
    const tracked = tryGit(['ls-files', '--error-unmatch', file]);
    if (!tracked && existsSync(join(root, file))) {
      parts.push(readFileSync(join(root, file), 'utf8')
        .split('\n')
        .map((line) => `+${line}`)
        .join('\n'));
    }
  }

  return parts
    .filter(Boolean)
    .join('\n')
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));
}

function stripSign(line) {
  return line.slice(1).trim();
}

function packageJsonDependencyChange({ base } = {}) {
  const currentPath = join(root, 'package.json');
  if (!existsSync(currentPath)) return false;
  let current;
  try {
    current = JSON.parse(readFileSync(currentPath, 'utf8'));
  } catch {
    return true;
  }

  const ref = base || 'HEAD';
  let previousText = '';
  try {
    previousText = git(['show', `${ref}:package.json`]);
  } catch {
    return true;
  }
  let previous;
  try {
    previous = JSON.parse(previousText);
  } catch {
    return true;
  }

  return PACKAGE_DEPENDENCY_KEYS.some(
    (key) => JSON.stringify(current[key] ?? null) !== JSON.stringify(previous[key] ?? null),
  );
}

function commentOnly(lines) {
  return lines.length > 0 && lines.every((line) => {
    const value = stripSign(line);
    return value === ''
      || value.startsWith('//')
      || value.startsWith('/*')
      || value.startsWith('*')
      || value.startsWith('*/');
  });
}

function dataJsRisky(lines) {
  // Farben sind reine Darstellung. Alles andere in sb-data.js kann
  // Material-IDs, Weltgröße oder gespeicherte Werkzeug-IDs betreffen.
  return lines.some((line) => {
    const value = stripSign(line);
    if (value === '' || value.startsWith('//') || value.startsWith('*')) return false;
    return !value.startsWith('colors[');
  });
}

function uiJsRisky(lines) {
  return lines.some((line) => (
    /saveCurrentWorld|loadUserWorld|deleteUserWorld|dbStorage|saveAllSettings|loadSavedState|appState|currentEditingWorld|ChunkEngine\.(importWorld|exportWorld)/
      .test(line)
  ));
}

function indexHtmlRisky(lines) {
  return lines.some((line) => (
    /serviceWorker|navigator\.serviceWorker|sw\.js|<script\b/i.test(line)
  ));
}

function manifestRisky(lines) {
  return lines.some((line) => /"(start_url|scope|display|icons)"/.test(line));
}

function isProductionFile(file) {
  if (file.endsWith('.md')) return false;
  if (file === 'index.html' || file === 'sw.js' || file === 'manifest.json') return true;
  if (file === 'pwa-icon.png' || file === 'robots.txt' || file === 'sitemap.xml') return true;
  if (file === 'vercel.json') return true;
  if (/^sb-.*\.(js|css)$/.test(file)) return true;
  if (file.startsWith('assets/')) return true;
  if (file.startsWith('landing-page/')) return true;
  return false;
}

export function classifyDiff(files, options = {}) {
  const reasons = new Set();
  const productionFiles = files.filter(isProductionFile);

  if (files.includes('package-lock.json')) {
    reasons.add('package-lock.json: Abhängigkeiten geändert');
  }
  if (files.includes('package.json') && packageJsonDependencyChange(options)) {
    reasons.add('package.json: Dependencies, Engines oder Overrides geändert');
  }

  for (const file of files) {
    if (DATA_FILES.has(file)) {
      reasons.add(`${file}: Daten- oder Update-Pfad`);
      continue;
    }
    if (file === 'vercel.json') {
      reasons.add('vercel.json: Deployment- oder Update-Pfad');
      continue;
    }
    if (file === 'scripts/build.mjs') {
      reasons.add('scripts/build.mjs: Produktions-Build geändert');
      continue;
    }
    if (ENGINE_FILES.has(file)) {
      if (!commentOnly(changedLines(file, options))) {
        reasons.add(`${file}: Engine-Datei`);
      }
      continue;
    }
    if (file === 'sb-data.js' && dataJsRisky(changedLines(file, options))) {
      reasons.add('sb-data.js: Material-, Welt- oder Werkzeugdaten geändert');
      continue;
    }
    if (file === 'sb-ui.js' && uiJsRisky(changedLines(file, options))) {
      reasons.add('sb-ui.js: Speicher- oder Ladepfad geändert');
      continue;
    }
    if (file === 'index.html' && indexHtmlRisky(changedLines(file, options))) {
      reasons.add('index.html: Service-Worker- oder Engine-Einbindung geändert');
      continue;
    }
    if (file === 'manifest.json' && manifestRisky(changedLines(file, options))) {
      reasons.add('manifest.json: PWA- oder Update-Feld geändert');
      continue;
    }
    if (/^sb-.*\.js$/.test(file) && !['sb-data.js', 'sb-chunk.js', 'sb-storage.js', 'sb-ui.js'].includes(file)) {
      reasons.add(`${file}: neues Spielmodul`);
    }
  }

  const touchesLanding = files.some((file) => file.startsWith('landing-page/'));
  const touchesGameCode = files.some(
    (file) => file === 'index.html' || file === 'sw.js' || /^sb-.*\.js$/.test(file),
  );
  if (touchesLanding && touchesGameCode) {
    reasons.add('Spiel und Landingpage gemeinsam geändert');
  }
  if (productionFiles.length > 5) {
    reasons.add(`mehr als fünf produktive Dateien (${productionFiles.length})`);
  }

  const critical = [...reasons].some((reason) => /Engine|Daten|Update|Service-Worker|PWA|Spielmodul|Spiel und Landingpage|mehr als|erzwungen/.test(reason));
  const size = critical || productionFiles.length > 15
    ? 'XL'
    : productionFiles.length === 0
      ? 'XS'
      : productionFiles.length <= 2
        ? 'S'
        : productionFiles.length <= 5
          ? 'M'
          : 'L';
  return {
    scope: reasons.size > 0 ? 'GROSS' : 'KLEIN',
    size,
    reasons: [...reasons],
    files,
    productionFiles,
    tests: testsFor(files),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filenameOrImportMatches(file) {
  // Die App nutzt keine ES-Importe. Für künftige Testdateien trotzdem
  // Dateinamen-Treffer und explizite Importe berücksichtigen.
  const stem = file.replace(/\.[^.]+$/, '').split('/').pop();
  if (!stem) return [];
  const matches = [];
  for (const spec of ALL_SPECS) {
    const specName = spec.split('/').pop();
    const source = readFileSync(join(root, spec), 'utf8');
    const importPattern = new RegExp(
      `(?:from|require\\()\\s*['"][^'"]*${escapeRegExp(stem)}[^'"]*['"]`,
    );
    if (specName.includes(stem) || importPattern.test(source)) matches.push(spec);
  }
  return matches;
}

export function testsFor(files) {
  const selected = new Set();
  for (const file of files) {
    if (file.startsWith('tests/') && file.endsWith('.spec.mjs')) {
      selected.add(file);
      continue;
    }
    if (file === 'tests/helpers.mjs' || file === 'playwright.config.mjs') {
      for (const spec of SPEC_ORDER) selected.add(spec);
      continue;
    }
    for (const spec of filenameOrImportMatches(file)) selected.add(spec);
    if (file === 'index.html' || file === 'sb-ui.js') {
      selected.add(SPECS.smoke);
      selected.add(SPECS.core);
      continue;
    }
    if (file === 'sb-data.js' || file === 'sb-chunk.js' || file === 'sb-storage.js') {
      selected.add(SPECS.core);
      selected.add(SPECS.offline);
      continue;
    }
    if (ENGINE_FILES.has(file)) {
      selected.add(SPECS.smoke);
      selected.add(SPECS.core);
      selected.add(SPECS.offline);
      continue;
    }
    if (file === 'sw.js' || file === 'manifest.json' || file === 'pwa-icon.png') {
      selected.add(SPECS.offline);
      selected.add(SPECS.smoke);
      continue;
    }
    if (file === 'assets/game.css' || file === 'sb-styles.css' || file.startsWith('assets/')) {
      selected.add(SPECS.smoke);
      selected.add(SPECS.landing);
      continue;
    }
    if (file.startsWith('landing-page/')) {
      selected.add(SPECS.landing);
      continue;
    }
    if (file === 'vercel.json') {
      selected.add(SPECS.smoke);
      selected.add(SPECS.offline);
    }
  }
  return SPEC_ORDER.filter((spec) => selected.has(spec));
}
