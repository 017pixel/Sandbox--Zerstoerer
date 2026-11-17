#!/usr/bin/env node
/**
 * Führt nur die Browser-Tests aus, die zum aktuellen Diff passen.
 *
 *   npm run test:changed
 *   npm run test:changed -- --list
 *   npm run test:changed -- --base origin/main
 *
 * Dieses Projekt hat aktuell nur Playwright-Specs. Sobald Unit-Tests
 * dazukommen, müssen sie hier getrennt und dürfen nicht an Playwright
 * übergeben werden.
 */
import { spawnSync } from 'node:child_process';
import { classifyDiff, collectChangedFiles, refExists, root } from './diff-map.mjs';

const args = process.argv.slice(2);

function option(name, fallback = '') {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return args[index + 1] ?? fallback;
}

const base = option('--base', process.env.BASE_REF || '');
if (args.includes('--base') && !base) {
  console.error('test:changed: --base braucht einen Git-Ref, zum Beispiel origin/main.');
  process.exit(1);
}
if (base && !refExists(base)) {
  console.error(`test:changed: Git-Ref "${base}" existiert nicht.`);
  process.exit(1);
}
const listOnly = args.includes('--list');
const files = collectChangedFiles({ base });

if (files.length === 0) {
  console.log('test:changed: keine Änderungen gefunden.');
  process.exit(0);
}

const result = classifyDiff(files, { base });
console.log(`test:changed: Scope ${result.scope}`);
if (result.reasons.length > 0) {
  for (const reason of result.reasons) console.log(`- ${reason}`);
}

if (result.tests.length === 0) {
  console.log('test:changed: keine Browser-Tests betroffen.');
  process.exit(0);
}

const command = ['playwright', 'test', ...result.tests];
console.log(`test:changed: ${result.tests.join(', ')}`);
if (listOnly) {
  console.log(`Befehl: npx ${command.join(' ')}`);
  process.exit(0);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = spawnSync(npx, command, { cwd: root, stdio: 'inherit' });
if (run.error) {
  console.error(`test:changed: Playwright konnte nicht gestartet werden: ${run.error.message}`);
  process.exit(1);
}
process.exit(run.status ?? 1);
