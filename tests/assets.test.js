import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('entry points and imports use a consistent revision included in offline cache', () => {
  const root = new URL('../', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const html = read('index.html');
  const app = read('app.js');
  const sw = read('sw.js');
  const entry = html.match(/src="(\.\/app\.js\?v=\d+)"/)[1];
  const revision = new URL(entry,'https://example.com/').search;
  const refs = [...html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)].map(match=>match[1]);
  const imports = [...app.matchAll(/from '(\.\/[^']+)'/g)].map(match=>match[1]);
  const offline = JSON.parse(sw.match(/const FILES = (\[[^\]]+\]);/)[1].replaceAll("'",'"'));
  for (const ref of [...refs,...imports]) {
    const url = new URL(ref,root);
    assert.ok(existsSync(fileURLToPath(url)),ref);
    assert.ok(offline.includes(ref),`Missing offline asset: ${ref}`);
    if (/\.(js|css)\?/.test(ref)) assert.equal(url.search,revision);
  }
  assert.ok(imports.every(ref=>new URL(ref,root).search===revision));
  assert.ok(html.includes(`style.css${revision}`));
});
