#!/usr/bin/env node
/**
 * Klassifiziert den Git-Diff als KLEIN oder GROSS.
 *
 *   npm run release:scope
 *   npm run release:scope -- --json
 *   npm run release:scope -- --base origin/main
 *
 * KLEIN: kein Datenpfad, keine echte Engine-Änderung, höchstens fünf
 *        produktive Dateien.
 * GROSS: Datenpfad, Engine, Abhängigkeiten, Service Worker, Update-Flow,
 *        Deployment-Build oder übergreifender Umbau.
 */
import { appendFileSync } from 'node:fs';
import { classifyDiff, collectChangedFiles, refExists } from './diff-map.mjs';

const args = process.argv.slice(2);

function option(name, fallback = '') {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return args[index + 1] ?? fallback;
}

const base = option('--base', process.env.BASE_REF || '');
if (args.includes('--base') && !base) {
  console.error('release:scope: --base braucht einen Git-Ref, zum Beispiel origin/main.');
  process.exit(1);
}
if (base && !refExists(base)) {
  console.error(`release:scope: Git-Ref "${base}" existiert nicht.`);
  process.exit(1);
}
const force = option('--force', '').toLowerCase();
const asJson = args.includes('--json');
const githubOutput = args.includes('--github-output');

if (force && force !== 'gross') {
  console.error('release:scope: --force erlaubt nur "gross".');
  process.exit(1);
}

const files = collectChangedFiles({ base });
const classified = classifyDiff(files, { base });
const result = force === 'gross'
  ? {
    ...classified,
    scope: 'GROSS',
    reasons: ['erzwungen: gross', ...classified.reasons],
  }
  : classified;

if (asJson) {
  console.log(JSON.stringify({
    scope: result.scope,
    reasons: result.reasons,
    productionFiles: result.productionFiles,
    tests: result.tests,
    files: result.files,
  }, null, 2));
} else {
  console.log(`Scope: ${result.scope}`);
  console.log(`Produktive Dateien: ${result.productionFiles.length}`);
  if (result.reasons.length > 0) {
    console.log('Gründe:');
    for (const reason of result.reasons) console.log(`- ${reason}`);
  }
  if (result.tests.length > 0) {
    console.log(`Betroffene Tests: ${result.tests.join(', ')}`);
  } else {
    console.log('Betroffene Tests: keine Browser-Tests');
  }
  if (result.files.length > 0) {
    console.log('Dateien:');
    for (const file of result.files) console.log(`- ${file}`);
  }
}

if (githubOutput) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    console.error('release:scope: GITHUB_OUTPUT ist nicht gesetzt.');
    process.exit(1);
  }
  appendFileSync(outputFile, `scope=${result.scope}\n`);
}
