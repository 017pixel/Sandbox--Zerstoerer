#!/usr/bin/env node
/**
 * Release für Sandbox-Zerstörer vorbereiten.
 *
 * Schreibt die neue Version in alle vier Quellen und legt den
 * CHANGELOG-Block oben an. Es gibt kein Artwork, kein Popup und keine
 * Admin-Version.
 *
 * Aufruf:
 *   node .opencode/skills/app-update/scripts/release.mjs \
 *     --type patch \
 *     --points "fixed:Erster Punkt|improved:Zweiter Punkt"
 *
 * Optionen:
 *   --type patch|minor|major   Versionsstufe (Pflicht)
 *   --points "typ:Text|..."    mindestens ein Punkt (Pflicht)
 *   --date YYYY-MM-DD          Release-Datum, Standard ist heute
 *   --dry-run                  nur anzeigen, nichts schreiben
 *
 * Punkt-Typen:
 *   new        -> Erstellt
 *   improved   -> Verändert
 *   fixed      -> Verändert
 *   removed    -> Gelöscht
 *   technical  -> Technisch
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const TYPE_TO_CATEGORY = {
  new: 'Erstellt',
  improved: 'Verändert',
  fixed: 'Verändert',
  removed: 'Gelöscht',
  technical: 'Technisch',
};
const CATEGORY_ORDER = ['Erstellt', 'Verändert', 'Gelöscht', 'Technisch'];
const POINT_TYPES = Object.keys(TYPE_TO_CATEGORY);
const MAX_POINTS = 10;

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function parseOptions(argv) {
  const options = { points: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const name = flag.split('=')[0];
    if (name === '--dry-run') {
      if (flag.includes('=')) fail('Option --dry-run erwartet keinen Wert.');
      options.dryRun = true;
      continue;
    }
    const value = flag.includes('=') ? flag.slice(flag.indexOf('=') + 1) : argv[++index];
    if (!value || value.startsWith('--')) fail(`Option ${flag} braucht einen Wert.`);
    switch (name) {
      case '--type':
        options.type = value;
        break;
      case '--points':
        options.points = value.split('|').map((part) => part.trim()).filter(Boolean);
        break;
      case '--date':
        options.date = value;
        break;
      default:
        fail(`Unbekannte Option ${flag}.`);
    }
  }
  return options;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    fail(`${label}: erwartet genau einen Treffer, gefunden ${matches.length}.`);
  }
  return source.replace(pattern, replacement);
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    fail(`Version "${version}" ist nicht semantisch (X.Y.Z).`);
  }
  if (type === 'major') return `${parts[0] + 1}.0.0`;
  if (type === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
  if (type === 'patch') return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  fail(`Unbekannte Versionsstufe "${type}". Erlaubt sind patch, minor, major.`);
  return version;
}

function todayLocal() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`Datum "${value}" muss YYYY-MM-DD sein.`);
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    fail(`Datum "${value}" existiert nicht.`);
  }
  return value;
}

function parsePoints(rawPoints) {
  if (rawPoints.length === 0) fail('--points fehlt.');
  if (rawPoints.length > MAX_POINTS) {
    fail(`Höchstens ${MAX_POINTS} Punkte, es kamen ${rawPoints.length}.`);
  }
  const seen = new Set();
  return rawPoints.map((entry) => {
    const separator = entry.indexOf(':');
    if (separator < 0) fail(`Punkt "${entry}" braucht die Form typ:Text.`);
    const type = entry.slice(0, separator).trim();
    const text = entry.slice(separator + 1).trim();
    if (!POINT_TYPES.includes(type)) {
      fail(`Typ "${type}" ist unbekannt. Erlaubt: ${POINT_TYPES.join(', ')}.`);
    }
    if (text.length < 3) fail(`Punkt "${entry}" hat keinen brauchbaren Text.`);
    if (text.length > 180) fail(`Punkt "${entry}" ist länger als 180 Zeichen.`);
    if (/\p{Extended_Pictographic}/u.test(text)) fail(`Punkt "${entry}" enthält ein Emoji.`);
    if (seen.has(text)) fail(`Punkt "${text}" steht doppelt.`);
    seen.add(text);
    return { type, text };
  });
}

const options = parseOptions(process.argv.slice(2));
if (!options.type) fail('--type patch|minor|major fehlt.');
if (!['patch', 'minor', 'major'].includes(options.type)) {
  fail(`--type ${options.type} ist unbekannt.`);
}
const points = parsePoints(options.points);
const date = validateDate(options.date || todayLocal());

const paths = {
  index: join(root, 'index.html'),
  sw: join(root, 'sw.js'),
  changelog: join(root, 'CHANGELOG.md'),
  readme: join(root, 'README.md'),
};
for (const [label, path] of Object.entries(paths)) {
  if (!existsSync(path)) fail(`${label} fehlt: ${path}`);
}

const source = {
  index: readFileSync(paths.index, 'utf8'),
  sw: readFileSync(paths.sw, 'utf8'),
  changelog: readFileSync(paths.changelog, 'utf8'),
  readme: readFileSync(paths.readme, 'utf8'),
};

const metaMatches = [...source.index.matchAll(/<meta name="application-version" content="([^"]+)">/g)];
if (metaMatches.length !== 1) {
  fail(`index.html: erwartet genau eine application-version, gefunden ${metaMatches.length}.`);
}
const currentVersion = metaMatches[0][1];
if (!/^\d+\.\d+\.\d+$/.test(currentVersion)) {
  fail(`Aktuelle Version "${currentVersion}" ist nicht semantisch.`);
}

const nextVersion = bumpVersion(currentVersion, options.type);
const versionPattern = escapeRegExp(currentVersion);

if (new RegExp(`^## \\[${escapeRegExp(nextVersion)}\\]`, 'm').test(source.changelog)) {
  fail(`CHANGELOG.md enthält bereits einen Eintrag für ${nextVersion}.`);
}
if (new RegExp(`## \\[${versionPattern}\\]`, 'm').test(source.changelog) === false) {
  fail(`CHANGELOG.md enthält keinen Eintrag für die aktuelle Version ${currentVersion}.`);
}

let index = replaceExactlyOnce(
  source.index,
  new RegExp(`(<meta name="application-version" content=")${versionPattern}(">)`, 'g'),
  `$1${nextVersion}$2`,
  'index.html application-version',
);
index = replaceExactlyOnce(
  index,
  new RegExp(`(<span>)v${versionPattern}(</span>)`, 'g'),
  `$1v${nextVersion}$2`,
  'index.html Versionsanzeige',
);

const sw = replaceExactlyOnce(
  source.sw,
  new RegExp(`(const CACHE_NAME = 'sandbox-v)${versionPattern}(';)`, 'g'),
  `$1${nextVersion}$2`,
  'sw.js CACHE_NAME',
);

const readme = replaceExactlyOnce(
  source.readme,
  new RegExp(`(Aktuell: \\*\\*)${versionPattern}(\\*\\*)`, 'g'),
  `$1${nextVersion}$2`,
  'README.md Versionsangabe',
);

const blockLines = [`## [${nextVersion}] - ${date}`, ''];
for (const category of CATEGORY_ORDER) {
  const entries = points.filter((point) => TYPE_TO_CATEGORY[point.type] === category);
  if (entries.length === 0) continue;
  blockLines.push(`### ${category}`);
  for (const entry of entries) blockLines.push(`- ${entry.text}`);
  blockLines.push('');
}
const block = `${blockLines.join('\n').trimEnd()}\n`;

const headerMatch = source.changelog.match(/^# Changelog[ \t]*\r?\n\r?\n/);
if (!headerMatch) fail('CHANGELOG.md beginnt nicht mit "# Changelog" und einer Leerzeile.');
const rest = source.changelog.slice(headerMatch[0].length).trimStart();
const changelog = `${headerMatch[0]}${block}\n${rest}`;

console.log(`release: ${currentVersion} -> ${nextVersion} (${options.type}, ${date})`);
for (const point of points) {
  console.log(`release: ${TYPE_TO_CATEGORY[point.type]}: ${point.text}`);
}

if (options.dryRun) {
  console.log('release: dry-run, keine Dateien geschrieben');
  console.log('');
  console.log(block.trimEnd());
  process.exit(0);
}

writeFileSync(paths.index, index);
writeFileSync(paths.sw, sw);
writeFileSync(paths.readme, readme);
writeFileSync(paths.changelog, changelog);

console.log('release: index.html, sw.js, README.md und CHANGELOG.md aktualisiert');
console.log('release: als Nächstes check.mjs, Build und Spielstand-Test laufen lassen');
