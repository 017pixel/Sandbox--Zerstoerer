// Only ship game and landing-page files, never notes or tooling.
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of await readdir('.')) {
  if (/^(index\.html|sb-[\w-]+\.(js|css)|sw\.js|version\.json|manifest\.json|pwa-icon\.png|robots\.txt|sitemap\.xml)$/.test(file)) {
    await cp(file, `dist/${file}`);
  }
}
await cp('assets', 'dist/assets', { recursive: true });
await mkdir('dist/landing-page');
for (const file of await readdir('landing-page')) {
  if (/\.(html|css|js)$/.test(file) || file === 'assets') {
    await cp(`landing-page/${file}`, `dist/landing-page/${file}`, { recursive: true });
  }
}
console.log('Static game and landing page built in dist/');
