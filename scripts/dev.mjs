#!/usr/bin/env node
// Dev mode: build, serve, rebuild on every change in content/, src/, static/ or scripts/.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rebuild = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { stdio: 'inherit' });

rebuild();
serve();

let timer;
for (const dir of ['content', 'src', 'static', 'scripts']) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  fs.watch(full, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 120);
  });
}
console.log('TRIAD ▲ watching for changes…');
