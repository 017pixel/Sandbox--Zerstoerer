#!/usr/bin/env node
/**
 * Projektprüfung für Sandbox-Zerstörer.
 *
 * Prüft Version, Cache, Doku, Tests, Manifest, Dateiverweise und Syntax.
 * Mit --dist zusätzlich den Build-Ordner nach `node scripts/build.mjs`.
 *
 *   npm run check
 *   npm run check:dist
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkDist = process.argv.includes('--dist');
const errors = [];
let checkedLinks = 0;

function fail(message) {
  errors.push(message);
}

function read(path, label) {
  if (!existsSync(path)) {
    fail(`${label} fehlt: ${relative(root, path)}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

function readJson(path, label) {
  const text = read(path, label);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} ist kein gültiges JSON: ${error.message}`);
    return null;
  }
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function checkVersionInIndex(html, baseDir, label) {
  const metas = [...html.matchAll(/<meta name="application-version" content="([^"]+)">/g)];
  if (metas.length !== 1) {
    fail(`${label}: erwartet genau eine application-version, gefunden ${metas.length}`);
    return null;
  }
  const version = metas[0][1];
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`${label}: Version "${version}" ist nicht semantisch`);
  }
  const spans = [...html.matchAll(/<span>v(\d+\.\d+\.\d+)<\/span>/g)];
  if (spans.length !== 1 || spans[0][1] !== version) {
    fail(`${label}: Versionsanzeige passt nicht zur application-version`);
  }

  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    let ref = match[1].split(/[?#]/)[0];
    if (!ref || /^(https?:)?\/\//.test(ref) || ref.startsWith('#') || /^(data|mailto|tel):/.test(ref)) {
      continue;
    }
    if (ref.startsWith('/')) {
      ref = ref.slice(1);
      if (existsSync(join(baseDir, ref))) continue;
      if (existsSync(join(baseDir, ref, 'index.html'))) continue;
    } else if (existsSync(join(baseDir, ref))) {
      continue;
    }
    fail(`${label}: Verweis "${match[1]}" zeigt auf keine vorhandene Datei`);
  }
  return version;
}

function extractAssets(swSource, baseDir, label) {
  const block = swSource.match(/const ASSETS = \[([\s\S]*?)\];/);
  if (!block) {
    fail(`${label}: ASSETS-Liste nicht gefunden`);
    return [];
  }
  const entries = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  if (entries.length === 0) fail(`${label}: ASSETS-Liste ist leer`);
  for (const required of ['./index.html', './manifest.json', './pwa-icon.png', './assets/game.css']) {
    if (!entries.includes(required)) fail(`${label}: ${required} fehlt in ASSETS`);
  }
  for (const entry of entries) {
    const path = entry === './' ? '' : entry.replace(/^\.\//, '');
    if (path && !existsSync(join(baseDir, path))) {
      fail(`${label}: Cache-Datei "${entry}" fehlt`);
    }
  }
  return entries;
}

function checkBrowserSyntax(files) {
  for (const file of files) {
    try {
      new vm.Script(readFileSync(file, 'utf8'), { filename: relative(root, file) });
    } catch (error) {
      fail(`Syntaxfehler in ${relative(root, file)}: ${error.message}`);
    }
  }
}

function checkNodeSyntax(files) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (error) {
      const message = error.stderr?.toString().trim() || error.message;
      fail(`Syntaxfehler in ${relative(root, file)}: ${message}`);
    }
  }
}

function stripCodeFences(text) {
  return text.replace(/```[\s\S]*?```/g, '');
}

function checkMarkdownLinks(file) {
  const text = stripCodeFences(readFileSync(file, 'utf8'));
  const base = dirname(file);
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '');
    if (!target || /^(https?:|mailto:|tel:|data:|#)/.test(target)) continue;
    const path = target.split('#')[0].split('?')[0];
    if (!path) continue;
    checkedLinks += 1;
    const resolved = path.startsWith('/') ? join(root, path) : resolve(base, path);
    if (!existsSync(resolved)) {
      fail(`${relative(root, file)}: Link "${target}" zeigt auf keine vorhandene Datei`);
    }
  }
}

// --- Quellen ---
const indexHtml = read(join(root, 'index.html'), 'index.html');
const swSource = read(join(root, 'sw.js'), 'sw.js');
const readme = read(join(root, 'README.md'), 'README.md');
const changelog = read(join(root, 'CHANGELOG.md'), 'CHANGELOG.md');
const manifest = readJson(join(root, 'manifest.json'), 'manifest.json');
const vercel = readJson(join(root, 'vercel.json'), 'vercel.json');
const packageJson = readJson(join(root, 'package.json'), 'package.json');

const version = checkVersionInIndex(indexHtml, root, 'index.html');
const cache = swSource.match(/const CACHE_NAME = 'sandbox-v([^']+)';/);
if (!cache) {
  fail('sw.js: CACHE_NAME hat nicht das Format sandbox-vX.Y.Z');
} else if (version && cache[1] !== version) {
  fail(`sw.js: Cache "${cache[1]}" passt nicht zur Version "${version}"`);
}

const assets = extractAssets(swSource, root, 'sw.js');
if (assets.includes('./') === false) fail('sw.js: "./" fehlt in ASSETS');

const gameModules = readdirSync(root).filter((file) => /^sb-.*\.js$/.test(file));
for (const file of gameModules) {
  if (!assets.includes(`./${file}`)) fail(`sw.js: ${file} fehlt in ASSETS`);
}
const gameStyles = readdirSync(root).filter((file) => /^sb-.*\.css$/.test(file));
for (const file of gameStyles) {
  if (!assets.includes(`./${file}`)) fail(`sw.js: ${file} fehlt in ASSETS`);
}

const readmeVersion = readme.match(/Aktuell: \*\*(\d+\.\d+\.\d+)\*\*/);
if (!readmeVersion) fail('README.md: "Aktuell: **X.Y.Z**" fehlt');
else if (version && readmeVersion[1] !== version) {
  fail(`README.md: Version "${readmeVersion[1]}" passt nicht zu "${version}"`);
}

const release = readJson(join(root, 'version.json'), 'version.json');
if (version && release.version !== version) {
  fail(`version.json: Version "${release.version}" passt nicht zu "${version}"`);
}
if (release.mode !== 'silent' && release.mode !== 'announced') {
  fail(`version.json: mode muss silent oder announced sein, ist "${release.mode}"`);
}
if (!Array.isArray(release.notes)) fail('version.json: notes muss ein Array sein');
else if (release.mode === 'announced' && release.notes.length !== 3) {
  fail(`version.json: announced braucht genau drei notes, hat ${release.notes.length}`);
} else if (release.mode === 'silent' && release.notes.length !== 0) {
  fail('version.json: silent darf keine notes haben');
}

const changelogTop = changelog.match(
  /^# Changelog[ \t]*\r?\n+## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/m,
);
if (!changelogTop) fail('CHANGELOG.md: kein Eintrag mit Version und Datum gefunden');
else {
  if (version && changelogTop[1] !== version) {
    fail(`CHANGELOG.md: oberste Version "${changelogTop[1]}" passt nicht zu "${version}"`);
  }
  const [year, month, day] = changelogTop[2].split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    fail(`CHANGELOG.md: Datum "${changelogTop[2]}" ist ungültig`);
  }
}

if (manifest) {
  if (!manifest.name || !manifest.short_name) fail('manifest.json: name oder short_name fehlt');
  if (manifest.start_url === undefined) fail('manifest.json: start_url fehlt');
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail('manifest.json: icons fehlen');
  } else {
    for (const icon of manifest.icons) {
      if (icon.src && !existsSync(join(root, icon.src))) {
        fail(`manifest.json: Icon "${icon.src}" fehlt`);
      }
    }
  }
}

if (vercel) {
  if (vercel.buildCommand !== 'node scripts/build.mjs') {
    fail('vercel.json: buildCommand muss "node scripts/build.mjs" sein');
  }
  if (vercel.outputDirectory !== 'dist') {
    fail('vercel.json: outputDirectory muss "dist" sein');
  }
  const swHeader = vercel.headers?.find((header) => header.source === '/sw.js');
  const noCache = swHeader?.headers?.some(
    (header) => header.key?.toLowerCase() === 'cache-control' && header.value === 'no-cache',
  );
  if (!noCache) fail('vercel.json: /sw.js braucht Cache-Control no-cache');
}

if (packageJson) {
  const requiredScripts = [
    'start', 'stop', 'status', 'restart', 'build', 'release:scope',
    'test:changed', 'test:smoke', 'test:e2e', 'test:landing',
    'check:source', 'check:quick', 'check', 'check:dist', 'release',
  ];
  for (const script of requiredScripts) {
    if (!packageJson.scripts?.[script]) fail(`package.json: Script "${script}" fehlt`);
  }
  if (!packageJson.devDependencies?.['@playwright/test']) {
    fail('package.json: @playwright/test fehlt in devDependencies');
  }
}

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  'DEPLOYMENT.md',
  'docs/README.md',
  'docs/ARCHITECTURE.md',
  'docs/TESTING.md',
  'docs/RELEASING.md',
  'playwright.config.mjs',
  'tests/helpers.mjs',
  'tests/smoke.spec.mjs',
  'tests/core.spec.mjs',
  'tests/offline.spec.mjs',
  'tests/landing.spec.mjs',
  'scripts/diff-map.mjs',
  'scripts/release-scope.mjs',
  'scripts/test-changed.mjs',
  'scripts/check-quick.mjs',
  '.github/workflows/verify.yml',
  '.agents/skills/update/SKILL.md',
  '.agents/skills/update/references/data-safety.md',
  '.agents/skills/update/scripts/release.mjs',
];
for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) fail(`Pflichtdatei fehlt: ${file}`);
}

const workflowPath = join(root, '.github/workflows/verify.yml');
if (existsSync(workflowPath)) {
  const workflow = readFileSync(workflowPath, 'utf8');
  if (!workflow.includes('npm run check:quick')) {
    fail('CI: npm run check:quick fehlt im Workflow');
  }
  if (!/run:\s*npm run check\s*$/m.test(workflow)) {
    fail('CI: npm run check fehlt im Workflow');
  }
  if (!/^  gate:/m.test(workflow)) {
    fail('CI: Gate-Job fehlt im Workflow');
  }
}

for (const file of [
  'README.md',
  'AGENTS.md',
  'DEPLOYMENT.md',
  'docs/README.md',
  'docs/ARCHITECTURE.md',
  'docs/TESTING.md',
  'docs/RELEASING.md',
  '.agents/skills/update/SKILL.md',
  '.agents/skills/update/references/data-safety.md',
]) {
  const path = join(root, file);
  if (existsSync(path)) checkMarkdownLinks(path);
}

const jsFiles = gameModules.map((file) => join(root, file));
checkBrowserSyntax([...jsFiles, join(root, 'sw.js')]);

for (const match of indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  try {
    new vm.Script(match[1], { filename: 'index.html inline' });
  } catch (error) {
    fail(`Syntaxfehler im Inline-Script von index.html: ${error.message}`);
  }
}

const testFiles = existsSync(join(root, 'tests'))
  ? readdirSync(join(root, 'tests'))
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => `tests/${file}`)
  : [];
const scriptFiles = existsSync(join(root, 'scripts'))
  ? readdirSync(join(root, 'scripts'))
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => `scripts/${file}`)
  : [];

checkNodeSyntax([
  ...scriptFiles,
  'playwright.config.mjs',
  '.agents/skills/update/scripts/release.mjs',
  ...testFiles,
].map((file) => join(root, file)));

// --- Build ---
if (checkDist) {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) {
    fail('dist/ fehlt. Zuerst "npm run build" laufen lassen');
  } else {
    const distIndex = read(join(dist, 'index.html'), 'dist/index.html');
    const distSw = read(join(dist, 'sw.js'), 'dist/sw.js');
    const distVersion = checkVersionInIndex(distIndex, dist, 'dist/index.html');
    if (version && distVersion && distVersion !== version) {
      fail(`dist/index.html: Version "${distVersion}" passt nicht zu "${version}"`);
    }
    const distCache = distSw.match(/const CACHE_NAME = 'sandbox-v([^']+)';/);
    if (!distCache) fail('dist/sw.js: CACHE_NAME fehlt');
    else if (version && distCache[1] !== version) {
      fail(`dist/sw.js: Cache "${distCache[1]}" passt nicht zu "${version}"`);
    }
    extractAssets(distSw, dist, 'dist/sw.js');
    if (!existsSync(join(dist, 'landing-page', 'index.html'))) {
      fail('dist/landing-page/index.html fehlt');
    }
    if (!existsSync(join(dist, 'landing-page', 'demo.html'))) {
      fail('dist/landing-page/demo.html fehlt');
    }
    const forbidden = [
      'temp', '.opencode', '.github', 'scripts', 'tests', 'node_modules', '.git',
      '.vercel', '.dev', 'docs', 'playwright.config.mjs', 'package.json',
      'package-lock.json', 'AGENTS.md',
    ];
    for (const name of forbidden) {
      if (existsSync(join(dist, name))) fail(`dist/${name} darf nicht ausgeliefert werden`);
    }
    const markdown = walk(dist).filter((file) => file.endsWith('.md'));
    for (const file of markdown) {
      fail(`dist/${relative(dist, file)} ist eine Doku-Datei und darf nicht ausgeliefert werden`);
    }
  }
}

// --- Ergebnis ---
if (errors.length > 0) {
  console.error('check: fehlgeschlagen');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`check: Version ${version}`);
console.log(`check: ${assets.length} Cache-Dateien, ${checkedLinks} lokale Doku-Verweise`);
console.log(`check: ${jsFiles.length + 1} Browser-Dateien syntaktisch ok`);
console.log('check: package.json, Playwright-Setup und Pflichtdateien ok');
if (checkDist) console.log('check: dist sauber und versionsgleich');
console.log('check: ok');
