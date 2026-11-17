#!/usr/bin/env node
/**
 * Ein Befehl für den lokalen Betrieb.
 *
 *   npm start              startet den Static-Server
 *   npm start -- --open    startet und öffnet das Spiel im Browser
 *   npm run status         zeigt Status und URL
 *   npm run stop           beendet genau diesen Server
 *   npm run restart        startet neu
 *
 * Es gibt kein Backend und keine lokale Datenbank. Der Browser-Speicher
 * (IndexedDB) gehört zum jeweiligen Browserprofil und wird vom Server nicht
 * angefasst.
 */
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = join(root, '.dev');
const stateFile = join(stateDir, 'state.json');
const logFile = join(stateDir, 'dev.log');
const serverScript = join(root, 'scripts', 'dev-server.mjs');
const args = process.argv.slice(2);
const command = args[0] || 'start';
const openBrowser = args.includes('--open');

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return args[index + 1] ?? fallback;
}

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isOurServer(pid) {
  if (process.platform === 'win32') return true;
  try {
    const line = execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return line.includes('dev-server.mjs');
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function portIsFree(port) {
  return new Promise((resolvePromise) => {
    const probe = createServer();
    probe.once('error', () => resolvePromise(false));
    probe.once('listening', () => probe.close(() => resolvePromise(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function pickPort(preferred) {
  for (let port = preferred; port < preferred + 50; port += 1) {
    if (await portIsFree(port)) return port;
  }
  throw new Error(`Kein freier Port zwischen ${preferred} und ${preferred + 49}.`);
}

async function healthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(700),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(port, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await healthy(port)) return true;
    await sleep(150);
  }
  return false;
}

function printRunning(state) {
  console.log('Sandbox-Zerstörer läuft');
  console.log(`  Spiel:       http://127.0.0.1:${state.port}/`);
  console.log(`  Landingpage: http://127.0.0.1:${state.port}/landing-page`);
  console.log(`  Stoppen:     npm run stop`);
  console.log(`  Log:         .dev/dev.log`);
  console.log(`  Hinweis:     Änderungen erscheinen nach dem Neuladen (Dev-Cache).`);
}

function openUrl(url) {
  const command = process.platform === 'darwin'
    ? ['open', [url]]
    : process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try {
    const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch {
    // Der Server läuft auch ohne Browser.
  }
}

async function stopState(state, { quiet = false } = {}) {
  if (!state) return false;
  if (isRunning(state.pid) && isOurServer(state.pid)) {
    process.kill(state.pid, 'SIGTERM');
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && isRunning(state.pid)) await sleep(100);
    if (isRunning(state.pid)) process.kill(state.pid, 'SIGKILL');
    if (!quiet) console.log(`Dev-Server gestoppt (Port ${state.port}).`);
  } else if (!quiet && isRunning(state.pid)) {
    console.log('Der gespeicherte Prozess gehört nicht mehr zum Dev-Server. Nichts beendet.');
  }
  rmSync(stateFile, { force: true });
  return true;
}

async function start() {
  const existing = readState();
  if (existing && isRunning(existing.pid) && isOurServer(existing.pid)) {
    if (await healthy(existing.port)) {
      printRunning(existing);
      if (openBrowser) openUrl(`http://127.0.0.1:${existing.port}/`);
      return;
    }
    await stopState(existing, { quiet: true });
  } else if (existing) {
    rmSync(stateFile, { force: true });
  }

  const preferred = Number(option('--port', process.env.PORT || 8080));
  if (!Number.isInteger(preferred) || preferred < 1 || preferred > 65535) {
    throw new Error(`Ungültiger Port: ${option('--port', process.env.PORT || 8080)}`);
  }
  const port = await pickPort(preferred);

  mkdirSync(stateDir, { recursive: true });
  const logFd = openSync(logFile, 'a');
  const child = spawn(process.execPath, [serverScript, '--port', String(port), '--dev-cache-bust'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  closeSync(logFd);
  child.unref();

  const state = {
    pid: child.pid,
    port,
    url: `http://127.0.0.1:${port}/`,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);

  if (!(await waitForHealth(port))) {
    console.error('Dev-Server ist nicht erreichbar. Letzte Log-Zeilen:');
    try {
      console.error(readFileSync(logFile, 'utf8').trimEnd().split('\n').slice(-15).join('\n'));
    } catch {
      // Kein Log vorhanden.
    }
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      // Schon beendet.
    }
    rmSync(stateFile, { force: true });
    process.exitCode = 1;
    return;
  }

  printRunning(state);
  if (openBrowser) openUrl(state.url);
}

async function stop() {
  const state = readState();
  if (!state) {
    console.log('Dev-Server läuft nicht.');
    return;
  }
  await stopState(state);
}

async function status() {
  const state = readState();
  if (!state) {
    console.log('Dev-Server läuft nicht.');
    process.exitCode = 1;
    return;
  }
  const running = isRunning(state.pid) && isOurServer(state.pid) && await healthy(state.port);
  if (running) {
    printRunning(state);
    return;
  }
  console.log(`Dev-Server läuft nicht (gespeicherter Port ${state.port}).`);
  console.log('Aufräumen: npm run stop');
  process.exitCode = 1;
}

async function main() {
  switch (command) {
    case 'start':
      await start();
      break;
    case 'stop':
      await stop();
      break;
    case 'restart':
      await stop();
      await start();
      break;
    case 'status':
      await status();
      break;
    default:
      console.error(`Unbekannter Befehl "${command}". Erlaubt: start, stop, restart, status.`);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
