// Task 100: guards the first-load speed win. Run after `vite build`.
// The scripts and modulepreload links in dist/index.html are what every first visit downloads.
// This fails when their total grows past the budget, or when a heavy editor library sneaks back in.
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BUDGET_BYTES = 700 * 1024;
const HEAVY = /fabric|segmentationService|background-removers|ort[.-]|transformers|imgly/i;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [...new Set([...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
if (files.length === 0) {
  console.error('check-bundle-size: no scripts found in dist/index.html - run `vite build` first');
  process.exit(1);
}

let total = 0;
const heavy = [];
for (const f of files) {
  total += statSync(join(dist, f)).size;
  if (HEAVY.test(f)) heavy.push(f);
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`first-load JavaScript: ${kb(total)} in ${files.length} files (budget ${kb(BUDGET_BYTES)})`);
if (heavy.length > 0) {
  console.error(`heavy editor code is loaded on first visit: ${heavy.join(', ')}`);
  process.exit(1);
}
if (total > BUDGET_BYTES) {
  console.error('first-load JavaScript is over budget');
  process.exit(1);
}
