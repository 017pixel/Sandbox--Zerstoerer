#!/usr/bin/env node
/**
 * Kurzer Entwicklungs-Loop.
 *
 * Refuses to run on a GROSS diff so a data/engine change cannot silently skip
 * the full gate. For KLEIN: source checks plus the tests that match the diff.
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
  console.error('check:quick: --base braucht einen Git-Ref, zum Beispiel origin/main.');
  process.exit(1);
}
if (base && !refExists(base)) {
  console.error(`check:quick: Git-Ref "${base}" existiert nicht.`);
  process.exit(1);
}
const result = classifyDiff(collectChangedFiles({ base }), { base });

if (result.scope === 'GROSS') {
  console.error('check:quick: Diff ist GROSS. Nutze npm run check.');
  console.error('Nur die Quellen prüfen: npm run check:source.');
  for (const reason of result.reasons) console.error(`- ${reason}`);
  process.exit(1);
}

console.log('check:quick: Diff ist KLEIN.');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env, ...(base ? { BASE_REF: base } : {}) };
for (const script of ['check:source', 'test:changed']) {
  const run = spawnSync(npm, ['run', script], { cwd: root, stdio: 'inherit', env });
  if (run.error) {
    console.error(`check:quick: ${script} konnte nicht gestartet werden: ${run.error.message}`);
    process.exit(1);
  }
  if (run.status !== 0) process.exit(run.status ?? 1);
}
